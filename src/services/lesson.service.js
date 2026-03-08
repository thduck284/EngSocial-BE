import { Lesson, UserLessonProgress, UserSkillStats, User } from '../models/index.js'
import { LessonDTO, LessonDetailDTO, UserLessonProgressDTO, UserSkillStatsDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { generateUniqueSlug } from '../utils/slug.js'

/**
 * Get all lessons with filters and pagination
 */
export const getLessons = async ({ skill, level, status = 'published', search, featured, page = 1, limit = 10 }) => {
  const filter = {}
  if (skill) filter.skill = skill
  if (level) filter.level = level
  if (status) filter.status = status
  if (featured !== undefined) filter.featured = featured === 'true' || featured === true
  if (search) filter.$text = { $search: search }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Lesson.countDocuments(filter)
  const lessons = await Lesson.find(filter)
    .select('-content -questions -vocabulary')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    lessons: lessons.map(l => new LessonDTO(l)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get lesson detail by slug
 */
export const getLessonBySlug = async (slug) => {
  const lesson = await Lesson.findOne({ slug, status: 'published' })
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  return new LessonDetailDTO(lesson)
}

/**
 * Get lesson detail by ID
 */
export const getLessonById = async (lessonId) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  return new LessonDetailDTO(lesson)
}

/**
 * Create lesson (teacher/admin)
 */
export const createLesson = async (data, userId) => {
  const slug = generateUniqueSlug(data.title)
  const lesson = await Lesson.create({
    ...data,
    slug,
    createdBy: userId,
    totalQuestions: data.questions?.length || 0,
  })
  return new LessonDetailDTO(lesson)
}

/**
 * Update lesson (teacher/admin)
 */
export const updateLesson = async (lessonId, data, userId) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  // Only the creator or admin can update
  if (lesson.createdBy?.toString() !== userId) {
    throw new Error('FORBIDDEN')
  }

  Object.assign(lesson, data)
  if (data.questions) lesson.totalQuestions = data.questions.length
  if (data.title) lesson.slug = generateUniqueSlug(data.title)
  await lesson.save()
  return new LessonDetailDTO(lesson)
}

/**
 * Delete lesson (teacher/admin)
 */
export const deleteLesson = async (lessonId, userId) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  if (lesson.createdBy?.toString() !== userId) {
    throw new Error('FORBIDDEN')
  }
  await Lesson.deleteOne({ _id: lessonId })
  return true
}

/**
 * Start or resume a lesson - create/update progress
 */
export const startLesson = async (userId, lessonId) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  let progress = await UserLessonProgress.findOne({ userId, lessonId })
  if (!progress) {
    progress = await UserLessonProgress.create({
      userId,
      lessonId,
      status: 'in_progress',
      startedAt: new Date(),
      lastAccessedAt: new Date(),
      maxScore: lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0),
    })
  } else {
    progress.lastAccessedAt = new Date()
    if (progress.status === 'not_started') progress.status = 'in_progress'
    await progress.save()
  }

  return {
    lesson: new LessonDetailDTO(lesson),
    progress: new UserLessonProgressDTO(progress),
  }
}

/**
 * Submit answers for a lesson
 */
export const submitAnswers = async (userId, lessonId, { answers, timeSpent }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  let progress = await UserLessonProgress.findOne({ userId, lessonId })
  if (!progress) {
    progress = await UserLessonProgress.create({
      userId, lessonId, status: 'in_progress', startedAt: new Date(),
      maxScore: lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0),
    })
  }

  // Grade answers
  let score = 0
  const gradedAnswers = answers.map(a => {
    const question = lesson.questions.find(q => q.id === a.questionId)
    if (!question) return { ...a, isCorrect: false, answeredAt: new Date() }

    let isCorrect = false
    if (Array.isArray(question.correctAnswer)) {
      isCorrect = Array.isArray(a.answer)
        ? JSON.stringify([...a.answer].sort()) === JSON.stringify([...question.correctAnswer].sort())
        : question.correctAnswer.includes(a.answer)
    } else {
      isCorrect = String(a.answer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim()
    }

    if (isCorrect) score += (question.points || 10)
    return { questionId: a.questionId, answer: a.answer, isCorrect, answeredAt: new Date() }
  })

  const maxScore = lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0)
  const progressPercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  progress.answers = gradedAnswers
  progress.score = score
  progress.maxScore = maxScore
  progress.progress = progressPercent
  progress.timeSpent = (progress.timeSpent || 0) + (timeSpent || 0)
  progress.attempts = (progress.attempts || 0) + 1
  if (score > progress.bestScore) progress.bestScore = score
  progress.lastAccessedAt = new Date()

  // Mark complete if answered all questions
  if (gradedAnswers.length >= lesson.questions.length) {
    progress.status = 'completed'
    progress.completedAt = new Date()

    // Award XP
    const xpEarned = lesson.xpReward || 50
    progress.xpEarned = (progress.xpEarned || 0) + xpEarned

    // Update user XP
    await User.findByIdAndUpdate(userId, {
      $inc: { xp: xpEarned, totalXp: xpEarned },
      lastActiveDate: new Date(),
    })

    // Update lesson completion count
    if (progress.attempts === 1) {
      await Lesson.findByIdAndUpdate(lessonId, { $inc: { completionCount: 1 } })
    }

    // Update skill stats
    await updateSkillStats(userId, lesson.skill, { score, maxScore, xpEarned, timeSpent: timeSpent || 0 })
  }

  await progress.save()
  return new UserLessonProgressDTO(progress)
}

/**
 * Submit writing for a lesson
 */
export const submitWriting = async (userId, lessonId, { content, wordCount }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson || lesson.skill !== 'writing') throw new Error('LESSON_NOT_FOUND')

  let progress = await UserLessonProgress.findOne({ userId, lessonId })
  if (!progress) {
    progress = await UserLessonProgress.create({
      userId, lessonId, status: 'in_progress', startedAt: new Date(),
    })
  }

  progress.submission = {
    content,
    wordCount: wordCount || content.split(/\s+/).length,
    submittedAt: new Date(),
  }
  progress.status = 'completed'
  progress.completedAt = new Date()
  progress.lastAccessedAt = new Date()

  const xpEarned = lesson.xpReward || 50
  progress.xpEarned = (progress.xpEarned || 0) + xpEarned

  await User.findByIdAndUpdate(userId, {
    $inc: { xp: xpEarned, totalXp: xpEarned },
    lastActiveDate: new Date(),
  })
  if (progress.attempts <= 1) {
    await Lesson.findByIdAndUpdate(lessonId, { $inc: { completionCount: 1 } })
  }

  progress.attempts = (progress.attempts || 0) + 1
  await progress.save()
  return new UserLessonProgressDTO(progress)
}

/**
 * Get user progress for all lessons (or filter by skill)
 */
export const getUserProgress = async (userId, { skill, status, page = 1, limit = 10 }) => {
  const filter = { userId }
  if (status) filter.status = status

  let lessonFilter = {}
  if (skill) lessonFilter.skill = skill

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })

  let query = UserLessonProgress.find(filter).populate('lessonId')
  const allProgress = await query.sort({ lastAccessedAt: -1 }).skip(skip).limit(perPage)

  // Filter by skill after populate
  const filtered = skill
    ? allProgress.filter(p => p.lessonId?.skill === skill)
    : allProgress

  const total = await UserLessonProgress.countDocuments(filter)

  return {
    progress: filtered.map(p => ({
      ...new UserLessonProgressDTO(p),
      lesson: p.lessonId ? new LessonDTO(p.lessonId) : null,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get user skill stats
 */
export const getUserSkillStats = async (userId) => {
  const stats = await UserSkillStats.find({ userId })
  return stats.map(s => new UserSkillStatsDTO(s))
}

/**
 * Internal: update skill stats after lesson completion
 */
const updateSkillStats = async (userId, skill, { score, maxScore, xpEarned, timeSpent }) => {
  let stats = await UserSkillStats.findOne({ userId, skill })
  if (!stats) {
    stats = await UserSkillStats.create({
      userId,
      skill,
      totalTimeSpent: 0,
      weeklyTimeSpent: 0,
      dailyTimeSpent: 0,
      lessonsCompleted: 0,
      lessonsInProgress: 0,
      averageScore: 0,
      highestScore: 0,
      totalXpEarned: 0,
      skillLevel: 'A1',
    })
  }

  stats.lessonsCompleted += 1
  stats.totalTimeSpent += timeSpent
  stats.dailyTimeSpent += timeSpent
  stats.weeklyTimeSpent += timeSpent
  stats.totalXpEarned += xpEarned
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  stats.averageScore = Math.round(
    (stats.averageScore * (stats.lessonsCompleted - 1) + pct) / stats.lessonsCompleted,
  )
  if (pct > stats.highestScore) stats.highestScore = pct
  stats.lastActivityAt = new Date()
  await stats.save()
}
