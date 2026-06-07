import mongoose from 'mongoose'
import Lesson from '../models/learning/Lesson.js'
import UserLessonProgress from '../models/learning/UserLessonProgress.js'
import * as lessonService from '../services/lesson.service.js'
import { LessonDTO, LessonDetailDTO } from '../dto/learning/response/lesson.response.js'
import { sendSuccess, sendPaginated, sendError } from '../dto/index.js'
import { generateUniqueSlug } from '../utils/slug.js'
import { checkAndUnlockAchievements } from '../services/achievementUnlock.service.js'

/**
 * Get lessons list with optional filters and pagination
 * GET /api/lessons?skill=reading&category=lesson|practice|all&level=B2&status=published&featured=true&topic=Science&page=1&limit=10
 */
export const getLessons = async (req, res, next) => {
  try {
    const { skill, level, topic, status = 'published', featured, category, page = 1, limit = 10, title } = req.query

    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (skill) filter.skill = skill
    if (level) filter.level = level
    if (topic) filter.topic = new RegExp(topic, 'i')
    if (title) filter.title = new RegExp(title, 'i')
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
    const featuredLessons = await Lesson.find({ status: 'published' })
      .sort({ completionCount: -1, rating: -1 })
      .limit(5)
      .select('title slug skill level topic thumbnail estimatedTime xpReward rating category completionCount')
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
 * Distinct lesson topics from published lessons in DB
 * GET /api/lessons/topics?category=lesson&status=published&skill=reading
 */
export const getLessonTopics = async (req, res, next) => {
  try {
    const { skill, category = 'lesson', status = 'published' } = req.query

    const filter = {
      topic: { $exists: true, $nin: [null, ''] },
    }
    if (status && status !== 'all') filter.status = status
    if (category && category !== 'all') filter.category = category
    if (skill && skill !== 'all') filter.skill = skill

    const topics = await Lesson.distinct('topic', filter)
    const data = topics
      .map((topic) => String(topic).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

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
      status: 'published',
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
      'featured', 'time', 'accent', 'practiceType', 'length', 'order', 'tags',
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
      score: progress?.score,
      maxScore: progress?.maxScore,
      answers: progress?.attemptHistory?.[(progress?.attemptHistory?.length || 1) - 1]?.answers || [],
      xpEarned: progress?.xpEarned,
      attempts: progress?.attempts || 0,
      submission: progress?.submission,
      aiScore: progress?.aiScore,
      aiFeedback: progress?.aiFeedback,
      attemptHistory: progress?.attemptHistory || [],
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Mod/admin: get a student's lesson progress for result view
 * GET /api/lessons/:id/progress/:targetUserId?attemptNo=1
 */
export const getLessonProgressForUser = async (req, res, next) => {
  try {
    const { id, targetUserId } = req.params
    const { attemptNo } = req.query
    const data = await lessonService.getLessonProgressForUser(id, targetUserId, { attemptNo })
    return sendSuccess(res, { data }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
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
 * Mark lesson as completed for the current user
 * POST /api/lessons/:id/complete (auth)
 * Luu v�o UserLessonProgress: status = 'completed', progress = 100, completedAt = now
 */
export const completeLesson = async (req, res, next) => {
  try {
    const { id } = req.params
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id xpReward skill category').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    let progress = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    })
    const now = new Date()
    const currentScore = progress?.score || 0
    const currentMaxScore = progress?.maxScore || 0
    const currentPercent = currentMaxScore > 0 ? Math.round((currentScore / currentMaxScore) * 100) : 0
    const eligibleForReward = currentPercent >= 80
    const xpThisAction = eligibleForReward ? (lesson.xpReward ?? 50) : 0
    if (!progress) {
      progress = await UserLessonProgress.create({
        userId: req.userId,
        lessonId: lesson._id,
        status: 'completed',
        progress: 100,
        completedAt: now,
        lastAccessedAt: now,
        startedAt: now,
        xpEarned: xpThisAction,
        notes: [],
      })
    } else {
      progress.status = 'completed'
      progress.progress = 100
      progress.completedAt = now
      progress.lastAccessedAt = now
      if (eligibleForReward) {
        progress.xpEarned = (progress.xpEarned || 0) + (lesson.xpReward ?? 50)
      }
      await progress.save()
    }
    const data = {
      status: progress.status,
      progress: progress.progress,
      completedAt: progress.completedAt,
      xpEarned: progress.xpEarned,
      xpEarnedThisAttempt: xpThisAction,
      rewardEligible: eligibleForReward,
    }
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Submit answers for reading/listening lesson
 * POST /api/lessons/:id/submit (auth)
 * Body: { answers: [{ questionId, questionIndex, answer }], timeSpent? }
 */
export const submitLessonAnswers = async (req, res, next) => {
  try {
    const { id } = req.params
    const { answers = [], timeSpent = 0, isMockTest = false } = req.body || {}
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    const progress = await lessonService.submitAnswers(req.userId, lesson._id.toString(), { answers, timeSpent, isMockTest })
    const latest = await UserLessonProgress.findOne({
      userId: req.userId,
      lessonId: lesson._id,
    }).select('attemptHistory').lean()
    const lastAttempt = latest?.attemptHistory?.[latest.attemptHistory.length - 1]
    const data = {
      ...progress,
      xpEarnedThisAttempt: lastAttempt?.xpEarned ?? 0,
      rewardEligible: (lastAttempt?.progress ?? 0) >= 80,
    }
    // Fire-and-forget achievement check
    const io = req.app.get('io')
    checkAndUnlockAchievements(req.userId, { io }).catch((e) =>
      console.warn('[achievement] submitLessonAnswers check failed:', e?.message)
    )
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Submit writing lesson
 * POST /api/lessons/:id/submit-writing (auth)
 * Body: { content, wordCount?, timeSpent? } — timeSpent: giây trên trang bài học
 */
export const submitWritingLesson = async (req, res, next) => {
  try {
    const { id } = req.params
    const { content = '', wordCount, timeSpent = 0, isMockTest = false } = req.body || {}
    const filter = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id }
    const lesson = await Lesson.findOne(filter).select('_id').lean()
    if (!lesson) {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    const progress = await lessonService.submitWriting(req.userId, lesson._id.toString(), {
      content,
      wordCount,
      timeSpent,
      isMockTest
    })
    // Fire-and-forget achievement check
    const io = req.app.get('io')
    checkAndUnlockAchievements(req.userId, { io }).catch((e) =>
      console.warn('[achievement] submitWritingLesson check failed:', e?.message)
    )
    return sendSuccess(res, { data: progress }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get reviews for a lesson
 * GET /api/lessons/:id/reviews
 */
export const getLessonReviews = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await lessonService.getLessonReviews(req.params.id, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    })
    return sendPaginated(res, {
      data: result.reviews,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Add or update review for a lesson
 * POST /api/lessons/:id/reviews
 */
export const addLessonReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body
    if (!rating || rating < 1 || rating > 10) {
      return sendError(res, {
        statusCode: 400,
        message: 'Rating must be between 1 and 10',
      }, req)
    }
    const review = await lessonService.addLessonReview(req.userId, req.params.id, { rating, comment })
    return sendSuccess(res, {
      message: 'Review submitted successfully',
      data: review,
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    next(error)
  }
}

/**
 * Get all user results for a lesson (Admin/Mod)
 * GET /api/lessons/:id/all-results
 */
export const getAllLessonResults = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const { id } = req.params
    const result = await lessonService.getAllLessonResults(id, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    })
    return sendPaginated(res, {
      data: result.results,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Re-sync quiz scores for all users (reading/listening only)
 * POST /api/lessons/:id/sync-scores
 */
export const syncLessonQuizScores = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await lessonService.syncLessonQuizScores(id)
    return sendSuccess(res, {
      message: 'Scores synced successfully',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, message: 'Lesson not found' }, req)
    }
    if (error.message === 'SYNC_SKILL_NOT_SUPPORTED') {
      return sendError(res, { statusCode: 400, message: 'Only reading and listening lessons can be synced' }, req)
    }
    if (error.message === 'LESSON_NO_QUESTIONS') {
      return sendError(res, { statusCode: 400, message: 'Lesson has no questions to grade' }, req)
    }
    next(error)
  }
}

/**
 * Grade user writing submission (Admin/Mod)
 * POST /api/lessons/:id/grade/:userId
 */
export const gradeUserWriting = async (req, res, next) => {
  try {
    const { id, userId } = req.params
    const { score, feedback, attemptNo } = req.body
    
    if (score === undefined || score === null) {
      return sendError(res, { statusCode: 400, message: 'Score is required' }, req)
    }

    const result = await lessonService.gradeUserWriting(id, userId, { score, feedback, attemptNo })
    // Fire-and-forget achievement check for the student who got graded
    const io = req.app.get('io')
    checkAndUnlockAchievements(userId, { io }).catch((e) =>
      console.warn('[achievement] gradeUserWriting check failed:', e?.message)
    )
    return sendSuccess(res, {
      message: 'Graded successfully',
      data: result,
    }, req)
  } catch (error) {
    next(error)
  }
}
/**
 * Get AI suggestion for writing submission (Admin/Mod)
 * POST /api/lessons/:id/ai-grade/:userId
 */
export const aiGradeWriting = async (req, res, next) => {
  try {
    const { id, userId } = req.params
    
    // Check permission: owner or mod/admin
    if (req.userId !== userId && !req.isModerator && !req.isAdmin) {
      return sendError(res, { statusCode: 403, message: 'Forbidden' }, req)
    }

    const result = await lessonService.aiGradeWriting(id, userId)
    return sendSuccess(res, {
      message: 'AI grading completed',
      data: result,
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get a specific user's lesson progress (Mod/Admin)
 * GET /api/lessons/user-progress/:targetUserId?skill=&status=&category=&page=&limit=
 */
export const getUserProgressByMod = async (req, res, next) => {
  try {
    const { targetUserId } = req.params
    const { skill, status, category, page = 1, limit = 50 } = req.query
    const result = await lessonService.getUserProgress(targetUserId, {
      skill: skill || undefined,
      status: status || undefined,
      category: category || undefined,
      page: parseInt(page, 10) || 1,
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
    })
    return sendPaginated(res, { data: result.progress, pagination: result.pagination }, req)
  } catch (error) {
    next(error)
  }
}
