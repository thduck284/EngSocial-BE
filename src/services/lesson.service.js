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
  const gradedAnswers = answers.map((a, idx) => {
    const qIndex =
      Number.isInteger(a.questionIndex)
        ? a.questionIndex
        : Number.isInteger(Number(a.questionId))
          ? Number(a.questionId) - 1
          : idx
    const question = lesson.questions[qIndex] || lesson.questions.find((q) => String(q.id) === String(a.questionId))
    if (!question) {
      return {
        questionId: String(a.questionId ?? question?.id ?? qIndex + 1),
        questionIndex: qIndex,
        answer: a.answer,
        isCorrect: false,
        answeredAt: new Date(),
      }
    }

    let isCorrect = false
    if (Array.isArray(question.correctAnswer)) {
      isCorrect = Array.isArray(a.answer)
        ? JSON.stringify([...a.answer].sort()) === JSON.stringify([...question.correctAnswer].sort())
        : question.correctAnswer.includes(a.answer)
    } else {
      isCorrect = String(a.answer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim()
    }

    if (isCorrect) score += (question.points || 10)
    return {
      questionId: String(a.questionId ?? question.id ?? qIndex + 1),
      questionIndex: qIndex,
      answer: a.answer,
      isCorrect,
      answeredAt: new Date(),
    }
  })

  const maxScore = lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0)
  const progressPercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const passedRewardThreshold = progressPercent >= 80

  progress.answers = gradedAnswers
  progress.score = score
  progress.maxScore = maxScore
  progress.progress = progressPercent
  progress.timeSpent = (progress.timeSpent || 0) + (timeSpent || 0)
  progress.attempts = (progress.attempts || 0) + 1
  const attemptNo = progress.attempts
  if (score > progress.bestScore) progress.bestScore = score
  progress.lastAccessedAt = new Date()
  let xpEarnedThisAttempt = 0

  // Mark complete if answered all questions
  if (gradedAnswers.length >= lesson.questions.length) {
    progress.status = 'completed'
    progress.completedAt = new Date()

    if (passedRewardThreshold) {
      const xpEarned = lesson.xpReward || 50
      xpEarnedThisAttempt = xpEarned
      progress.xpEarned = (progress.xpEarned || 0) + xpEarned

      await User.findByIdAndUpdate(userId, {
        $inc: { xp: xpEarned, totalXp: xpEarned },
        lastActiveDate: new Date(),
      })
    }

    // Update lesson completion count
    if (progress.attempts === 1) {
      await Lesson.findByIdAndUpdate(lessonId, { $inc: { completionCount: 1 } })
    }

    // Still update stats on completion, but reward XP only when >= 80%
    await updateSkillStats(userId, lesson.skill, {
      score,
      maxScore,
      xpEarned: xpEarnedThisAttempt,
      timeSpent: timeSpent || 0,
    })
  }

  progress.attemptHistory = progress.attemptHistory || []
  progress.attemptHistory.push({
    type: 'quiz',
    attemptNo,
    submittedAt: new Date(),
    score,
    maxScore,
    progress: progressPercent,
    xpEarned: xpEarnedThisAttempt,
    timeSpent: timeSpent || 0,
    answers: gradedAnswers,
  })

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
  const attemptNo = progress.attempts
  progress.attemptHistory = progress.attemptHistory || []
  progress.attemptHistory.push({
    type: 'writing',
    attemptNo,
    submittedAt: new Date(),
    progress: 100,
    xpEarned,
    submission: {
      content,
      wordCount: wordCount || content.split(/\s+/).length,
    },
  })
  await progress.save()
  return new UserLessonProgressDTO(progress)
}

/**
 * Get user progress for all lessons (or filter by skill)
 */
export const getUserProgress = async (userId, { skill, status, category, page = 1, limit = 10 }) => {
  const filter = { userId }
  if (status) filter.status = status

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })

  const allProgress = await UserLessonProgress.find(filter)
    .populate('lessonId')
    .sort({ lastAccessedAt: -1 })

  // Filter by skill and category after populate
  let filtered = allProgress
  if (skill) filtered = filtered.filter(p => p.lessonId?.skill === skill)
  if (category) filtered = filtered.filter(p => p.lessonId?.category === category)

  // Expand completed attempts so one lesson can show many results in history.
  const expanded = filtered.flatMap((p) => {
    const base = {
      ...new UserLessonProgressDTO(p),
      lesson: p.lessonId ? new LessonDTO(p.lessonId) : null,
    }
    const attempts = Array.isArray(p.attemptHistory) ? p.attemptHistory : []
    if (attempts.length === 0) return [base]
    return attempts.map((a) => ({
      ...base,
      id: `${base.id}-attempt-${a.attemptNo || 0}`,
      status: 'completed',
      progress: a.progress ?? base.progress,
      score: a.score ?? base.score,
      maxScore: a.maxScore ?? base.maxScore,
      xpEarned: a.xpEarned ?? 0,
      attemptNo: a.attemptNo || 0,
      submittedAt: a.submittedAt || base.updatedAt,
    }))
  })

  expanded.sort((a, b) => {
    const ta = new Date(a.submittedAt || a.lastAccessedAt || a.updatedAt || 0).getTime()
    const tb = new Date(b.submittedAt || b.lastAccessedAt || b.updatedAt || 0).getTime()
    return tb - ta
  })

  const total = expanded.length
  const pageItems = expanded.slice(skip, skip + perPage)

  return {
    progress: pageItems,
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
