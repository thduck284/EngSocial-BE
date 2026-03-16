import mongoose from 'mongoose'
import Lesson from '../models/learning/Lesson.js'
import UserLessonProgress from '../models/learning/UserLessonProgress.js'
import * as lessonService from '../services/lesson.service.js'
import { LessonDTO, LessonDetailDTO } from '../dto/learning/response/lesson.response.js'
import { sendSuccess, sendPaginated, sendError } from '../dto/index.js'
import { generateUniqueSlug } from '../utils/slug.js'

/**
 * Get lessons list with optional filters and pagination
 * GET /api/lessons?skill=reading&category=lesson|practice|all&level=B2&status=published&featured=true&topic=Science&page=1&limit=10
 */
export const getLessons = async (req, res, next) => {
  try {
    const { skill, level, topic, status = 'published', featured, category, page = 1, limit = 10 } = req.query

    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (skill) filter.skill = skill
    if (level) filter.level = level
    if (topic) filter.topic = new RegExp(topic, 'i')
    if (featured !== undefined) filter.featured = featured === 'true'
    if (category && category !== 'all') filter.category = category

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
    const skip = (pageNum - 1) * limitNum

    const LEVEL_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }
    const SKILL_ORDER = { reading: 1, listening: 2, writing: 3 }
    const select = 'title slug skill level topic description thumbnail estimatedTime xpReward totalQuestions rating ratingCount completionCount status featured tags category time accent practiceType length order'

    let data
    if (category === 'lesson') {
      const all = await Lesson.find(filter).select(select).lean()
      const sorted = all.sort((a, b) => {
        const levelDiff = (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99)
        if (levelDiff !== 0) return levelDiff
        return (SKILL_ORDER[a.skill] ?? 99) - (SKILL_ORDER[b.skill] ?? 99)
      })
      const total = sorted.length
      const lessonsRes = sorted.slice(skip, skip + limitNum)
      data = lessonsRes.map((l) => new LessonDTO(l).toJSON())
      const totalPages = Math.ceil(total / limitNum)
      return sendPaginated(res, {
        data,
        pagination: { currentPage: pageNum, perPage: limitNum, total, totalPages },
      }, req)
    }

    const sort = { order: 1, rating: -1, createdAt: -1 }
    const [total, lessonsRes] = await Promise.all([
      Lesson.countDocuments(filter),
      Lesson.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select(select)
        .lean(),
    ])

    data = lessonsRes.map((l) => new LessonDTO(l).toJSON())
    const totalPages = Math.ceil(total / limitNum)
    return sendPaginated(res, {
      data,
      pagination: { currentPage: pageNum, perPage: limitNum, total, totalPages },
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get current user's lesson progress (history of done/in-progress lessons)
 * GET /api/lessons/my-progress?skill=reading&status=completed&page=1&limit=10 (auth)
 */
export const getMyProgress = async (req, res, next) => {
  try {
    const { skill, status, category, page = 1, limit = 10 } = req.query
    const result = await lessonService.getUserProgress(req.userId, {
      skill: skill || undefined,
      status: status || undefined,
      category: category || undefined,
      page: parseInt(page, 10) || 1,
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    })
    return sendPaginated(res, { data: result.progress, pagination: result.pagination }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get dashboard data - from DB (featured lessons, etc.)
 * GET /api/lessons/dashboard
 */
export const getDashboard = async (req, res, next) => {
  try {
    const featuredLessons = await Lesson.find({ status: 'published', featured: true })
      .sort({ rating: -1, completionCount: -1 })
      .limit(6)
      .select('title slug skill level topic thumbnail estimatedTime xpReward rating')
      .lean()
    const data = {
      skillStats: [],
      featuredLessons: featuredLessons.map((l) => new LessonDTO(l).toJSON()),
      goals: [],
      suggestedGroups: [],
      leaderboard: [],
      friendSuggestions: [],
      userProfile: null,
      profileFriends: [],
      profileSkillStats: [],
      profileAchievements: [],
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get single lesson by id (admin or public) - full detail
 * GET /api/lessons/:id
 */
export const getLessonById = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    const dto = new LessonDetailDTO({ ...lesson, id: lesson._id?.toString() })
    return sendSuccess(res, { data: dto.toJSON() }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Create lesson (admin)
 * POST /api/lessons
 */
export const createLesson = async (req, res, next) => {
  try {
    const body = req.body
    const slug = body.slug || generateUniqueSlug(body.title || 'lesson')
    const existing = await Lesson.findOne({ slug })
    if (existing) {
      return sendError(res, { statusCode: 400, message: 'Slug already exists' }, req)
    }
    const content = body.content || {}
    const payload = {
      title: body.title,
      slug,
      skill: body.skill || 'reading',
      level: body.level || 'A1',
      category: body.category || 'lesson',
      topic: body.topic,
      description: body.description,
      thumbnail: body.thumbnail,
      content,
      questions: body.questions || [],
      vocabulary: body.vocabulary || [],
      estimatedTime: body.estimatedTime,
      xpReward: body.xpReward ?? 50,
      totalQuestions: body.totalQuestions ?? 0,
      status: body.status || 'draft',
      featured: body.featured ?? false,
      time: body.time,
      accent: content.accent ?? body.accent,
      practiceType: body.practiceType,
      length: body.length,
      order: body.order ?? 0,
      tags: body.tags || [],
      createdBy: req.userId,
    }
    const lesson = await Lesson.create(payload)
    const dto = new LessonDetailDTO(lesson)
    return sendSuccess(res, { data: dto.toJSON() }, req, 201)
  } catch (error) {
    next(error)
  }
}

/**
 * Update lesson (admin)
 * PUT /api/lessons/:id
 */
export const updateLesson = async (req, res, next) => {
  try {
    const { id } = req.params
    const lesson = await Lesson.findById(id)
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    const body = req.body
    const allowed = [
      'title', 'slug', 'skill', 'level', 'category', 'topic', 'description', 'thumbnail',
      'content', 'questions', 'vocabulary', 'estimatedTime', 'xpReward', 'totalQuestions',
      'status', 'featured', 'time', 'accent', 'practiceType', 'length', 'order', 'tags',
    ]
    for (const key of allowed) {
      if (body[key] !== undefined) {
        lesson[key] = body[key]
      }
    }
    if (body.content?.accent !== undefined) {
      lesson.accent = body.content.accent
    }
    await lesson.save()
    const dto = new LessonDetailDTO(lesson)
    return sendSuccess(res, { data: dto.toJSON() }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Delete lesson (admin)
 * DELETE /api/lessons/:id
 */
export const deleteLesson = async (req, res, next) => {
  try {
    const { id } = req.params
    const deleted = await Lesson.findByIdAndDelete(id)
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    return sendSuccess(res, { message: 'Deleted' }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get reading lesson content - l?y t? DB
 * GET /api/lessons/reading/:id/content
 * :id c� th? l� _id ho?c slug
 */
export const getReadingContent = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = { skill: 'reading', status: 'published' }
    if (mongoose.isValidObjectId(id)) {
      filter._id = id
    } else {
      filter.slug = id
    }
    const lesson = await Lesson.findOne(filter)
      .select('title slug skill level topic description thumbnail content questions vocabulary estimatedTime xpReward totalQuestions')
      .lean()

    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }

    const content = {
      title: lesson.title,
      level: lesson.level,
      topic: lesson.topic,
      description: lesson.description,
      time: `${lesson.estimatedTime || 15}m`,
      estimatedTime: lesson.estimatedTime || 15,
      questions: lesson.totalQuestions || (lesson.questions || []).length,
      xpReward: lesson.xpReward || 50,
      progress: 40,
      thumbnail: lesson.thumbnail,
      text: lesson.content?.text || '',
      translationVi: lesson.content?.translationVi || '',
      highlightedWords: [],
    }

    const questions = (lesson.questions || []).map((q, i) => {
      const options = (q.options && q.options.length > 0)
        ? q.options.map((o) => ({ value: o.value, text: o.text || o.value }))
        : (q.type === 'true_false' ? [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }] : [])
      return {
        id: i + 1,
        question: q.question,
        type: q.type || 'multiple_choice',
        options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        points: q.points,
      }
    })

    const data = {
      content,
      questions,
      vocabulary: lesson.vocabulary || [],
      leaderboard: [],
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get listening lesson content - l?y t? DB (full data cho trang b�i h?c)
 * GET /api/lessons/listening/:id/content
 */
export const getListeningContent = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = { skill: 'listening', status: 'published' }
    if (mongoose.isValidObjectId(id)) {
      filter._id = id
    } else {
      filter.slug = id
    }
    const lesson = await Lesson.findOne(filter)
      .select('title slug skill level topic description thumbnail content questions vocabulary estimatedTime xpReward totalQuestions time accent')
      .lean()

    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }

    const chapters = (lesson.content?.chapters || []).map((c, i) => ({
      id: c.id || `ch-${i}`,
      label: c.label,
      time: c.time || '0:00',
      startTime: c.startTime,
      done: i === 0,
      active: i === 1,
    }))

    const questions = (lesson.questions || []).map((q, i) => ({
      id: q.id || `q-${i}`,
      question: q.question,
      type: q.type,
      options: (q.options || []).map((o) => ({
        value: o.value,
        text: o.text,
        correct: o.value === q.correctAnswer,
      })),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: q.points,
    }))

    const firstQuestion = lesson.questions?.[0]
    const quizOptions = firstQuestion?.options?.map((o) => ({
      value: o.value,
      text: o.text,
      correct: o.value === firstQuestion.correctAnswer,
    })) || []

    const vocabList = (lesson.vocabulary || []).map((v, i) => ({
      word: v.word,
      phonetic: v.phonetic,
      meaning: v.meaning,
      meaningVi: v.meaningVi,
      example: v.example,
    }))
    const vocabCard = lesson.vocabulary?.[0] ? {
      word: lesson.vocabulary[0].word,
      phonetic: lesson.vocabulary[0].phonetic,
      meaning: lesson.vocabulary[0].meaning,
      progress: vocabList.length > 0 ? `1 / ${vocabList.length}` : '1 / 1',
    } : {}

    const data = {
      title: lesson.title,
      slug: lesson.slug,
      level: lesson.level,
      topic: lesson.topic,
      description: lesson.description,
      thumbnail: lesson.thumbnail,
      transcript: lesson.content?.transcript || '',
      audioUrl: lesson.content?.audioUrl || '',
      duration: lesson.content?.duration || 0,
      accent: lesson.content?.accent || lesson.accent || '',
      estimatedTime: lesson.estimatedTime,
      time: lesson.time,
      xpReward: lesson.xpReward || 50,
      totalQuestions: lesson.totalQuestions || (lesson.questions || []).length,
      chapters,
      questions,
      quizOptions,
      vocabCard,
      vocabulary: vocabList,
      leaderboard: [],
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get writing lesson content - l?y t? DB
 * GET /api/lessons/writing/:id/content
 * :id c� th? l� _id ho?c slug
 */
export const getWritingContent = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = { skill: 'writing', status: 'published' }
    if (mongoose.isValidObjectId(id)) {
      filter._id = id
    } else {
      filter.slug = id
    }
    const lesson = await Lesson.findOne(filter)
      .select('title slug skill level topic description thumbnail content questions vocabulary estimatedTime xpReward totalQuestions')
      .lean()

    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }

    const content = {
      title: lesson.title,
      level: lesson.level,
      topic: lesson.topic,
      time: `${lesson.estimatedTime || 15} ph�t`,
      xpReward: lesson.xpReward || 50,
      thumbnail: lesson.thumbnail,
      prompt: lesson.content?.prompt || '',
      wordLimit: lesson.content?.wordLimit || { min: 100, max: 150 },
      sampleAnswer: lesson.content?.sampleAnswer || '',
    }

    const data = {
      content,
      questions: lesson.questions || [],
      vocabulary: lesson.vocabulary || [],
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get user progress for a lesson (including notes)
 * GET /api/lessons/:id/progress (auth)
 */
export const getLessonProgress = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    const progress = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    }).lean()
    const data = {
      notes: progress?.notes || [],
      status: progress?.status,
      progress: progress?.progress,
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Add a note to lesson progress
 * POST /api/lessons/:id/notes (auth)
 * Body: { title, content, category }
 */
export const addLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params
    const { title = '', content = '', category = 'grammar' } = req.body || {}
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    let progress = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    })
    if (!progress) {
      progress = await UserLessonProgress.create({
        userId: req.userId,
        lessonId: lesson._id,
        status: 'in_progress',
        notes: [{ title, content, category, createdAt: new Date() }],
      })
    } else {
      progress.notes = progress.notes || []
      progress.notes.push({ title, content, category, createdAt: new Date() })
      progress.lastAccessedAt = new Date()
      await progress.save()
    }
    const data = { notes: progress.notes }
    return sendSuccess(res, { data }, req, 201)
  } catch (error) {
    next(error)
  }
}

/**
 * Update lesson progress (e.g. save draft = in_progress)
 * PATCH /api/lessons/:id/progress (auth)
 * Body: { status?: 'in_progress' | 'completed', progress?: number }
 */
export const updateLessonProgress = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status = 'in_progress', progress: progressPercent } = req.body || {}
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    let progress = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    })
    const now = new Date()
    if (!progress) {
      progress = await UserLessonProgress.create({
        userId: req.userId,
        lessonId: lesson._id,
        status: status === 'completed' ? 'completed' : 'in_progress',
        progress: progressPercent != null ? progressPercent : (status === 'completed' ? 100 : 0),
        completedAt: status === 'completed' ? now : undefined,
        lastAccessedAt: now,
        startedAt: now,
        notes: [],
      })
    } else {
      progress.status = status === 'completed' ? 'completed' : 'in_progress'
      if (progressPercent != null) progress.progress = progressPercent
      if (status === 'completed') {
        progress.completedAt = now
      }
      progress.lastAccessedAt = now
      await progress.save()
    }
    const data = { status: progress.status, progress: progress.progress }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Mark lesson as completed for the current user
 * POST /api/lessons/:id/complete (auth)
 * Luu v�o UserLessonProgress: status = 'completed', progress = 100, completedAt = now
 */
export const completeLesson = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id xpReward').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    let progress = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    })
    const now = new Date()
    if (!progress) {
      progress = await UserLessonProgress.create({
        userId: req.userId,
        lessonId: lesson._id,
        status: 'completed',
        progress: 100,
        completedAt: now,
        lastAccessedAt: now,
        startedAt: now,
        xpEarned: lesson.xpReward ?? 50,
        notes: [],
      })
    } else {
      progress.status = 'completed'
      progress.progress = 100
      progress.completedAt = now
      progress.lastAccessedAt = now
      if (progress.xpEarned == null) progress.xpEarned = lesson.xpReward ?? 50
      await progress.save()
    }
    const data = {
      status: progress.status,
      progress: progress.progress,
      completedAt: progress.completedAt,
      xpEarned: progress.xpEarned,
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}
