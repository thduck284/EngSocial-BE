import { Lesson, UserLessonProgress, UserSkillStats, User, LessonReview } from '../models/index.js'
import { LessonDTO, LessonDetailDTO, UserLessonProgressDTO, UserSkillStatsDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { generateUniqueSlug } from '../utils/slug.js'
import * as aiService from './ai.service.js'
import * as mockTestService from './mockTest.service.js'
import { pickSessionAttempt, submissionContentFromAttempt, resolveSessionAttemptWindow, isAttemptInSessionWindow } from '../utils/sessionAttempt.js'
import MockTestResult from '../models/learning/MockTestResult.js'
import { bumpPeriodicQuestsOnLessonEvent } from './userPeriodicQuest.service.js'
import { incrementChallengeProgressByRequirement } from './challenge.service.js'

/**
 * Tổng lượt làm (sum attempts) theo lessonId từ UserLessonProgress
 */
export async function attachAttemptCountsToLessons(lessonsLean) {
  if (!lessonsLean?.length) return lessonsLean || []
  const ids = lessonsLean.map((l) => l._id).filter(Boolean)
  const agg = await UserLessonProgress.aggregate([
    {
      $match: {
        lessonId: { $in: ids },
        isMockTest: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$lessonId',
        attemptCount: { $sum: { $ifNull: ['$attempts', 0] } },
      },
    },
  ])
  const map = new Map(agg.map((r) => [String(r._id), r.attemptCount]))
  return lessonsLean.map((l) => ({
    ...l,
    attemptCount: map.get(String(l._id)) ?? 0,
  }))
}

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
 * Grade quiz answers against current lesson questions (reading/listening)
 */
function gradeQuizAnswers(lesson, answers = []) {
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
        questionId: String(a.questionId ?? qIndex + 1),
        questionIndex: qIndex,
        answer: a.answer,
        isCorrect: false,
        answeredAt: a.answeredAt || new Date(),
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
      answeredAt: a.answeredAt || new Date(),
    }
  })

  const maxScore = lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0)
  const progressPercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return { score, maxScore, progressPercent, gradedAnswers }
}

/**
 * Submit answers for a lesson
 */
export const submitAnswers = async (userId, lessonId, { answers, timeSpent, isMockTest }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  let progress = await UserLessonProgress.findOne({ userId, lessonId })
  if (!progress) {
    progress = await UserLessonProgress.create({
      userId, lessonId, status: 'in_progress', startedAt: new Date(),
      maxScore: lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0),
    })
  }
  
  progress.isMockTest = !!isMockTest

  const { score, maxScore, progressPercent, gradedAnswers } = gradeQuizAnswers(lesson, answers)
  const passedRewardThreshold = progressPercent >= 80

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

      const user = await User.findById(userId)
      if (user) {
        user.awardXp(xpEarned)
        user.lastActiveDate = new Date()
        await user.save()
      }
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

    try {
      await bumpPeriodicQuestsOnLessonEvent(
        userId,
        lesson.skill || 'reading',
        progressPercent,
        lesson.category || 'lesson'
      )
    } catch (e) {
      console.warn('[periodicQuest] lesson submit bump:', e?.message)
    }
    try {
      await incrementChallengeProgressByRequirement(userId, 'lessons', 1)
      await incrementChallengeProgressByRequirement(userId, 'score', progressPercent)
    } catch (e) {
      console.warn('[challenge] lesson submit bump:', e?.message)
    }
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
export const submitWriting = async (userId, lessonId, { content, wordCount, timeSpent = 0, isMockTest }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson || lesson.skill !== 'writing') throw new Error('LESSON_NOT_FOUND')

  let progress = await UserLessonProgress.findOne({ userId, lessonId })
  if (!progress) {
    progress = await UserLessonProgress.create({
      userId, lessonId, status: 'in_progress', startedAt: new Date(),
    })
  }
  
  progress.isMockTest = !!isMockTest

  progress.submission = {
    content,
    wordCount: wordCount || content.split(/\s+/).length,
    submittedAt: new Date(),
    feedback: '',
    score: null,
  }
  progress.status = 'under_review'
  progress.lastAccessedAt = new Date()
  progress.timeSpent = (progress.timeSpent || 0) + (timeSpent || 0)

  // Build attempt history
  progress.attempts = (progress.attempts || 0) + 1
  progress.attemptHistory.push({
    type: 'writing',
    attemptNo: progress.attempts,
    submittedAt: new Date(),
    score: null,
    maxScore: null,
    progress: 0,
    xpEarned: 0,
    timeSpent: timeSpent || 0,
    submission: {
      content,
      wordCount: progress.submission.wordCount,
      feedback: '',
      score: null,
    },
  })

  await progress.save()

  // Trigger AI grading automatically for immediate feedback
  try {
    await aiGradeWriting(lessonId, userId, { attemptNo: progress.attempts })
    // Reload progress to get AI results
    const updatedProgress = await UserLessonProgress.findOne({ userId, lessonId })
    return new UserLessonProgressDTO(updatedProgress)
  } catch (error) {
    console.error('Auto AI grading failed:', error)
    return {
      success: true,
      status: 'under_review',
      attempts: progress.attempts,
      message: 'Submission successful, waiting for review'
    }
  }
}

/**
 * Get user progress for all lessons (or filter by skill)
 */
export const getUserProgress = async (userId, { skill, status, category, page = 1, limit = 10 }) => {
  const filter = { userId, isMockTest: { $ne: true } }
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
    // For Writing, if it's explicitly in_progress (no submission yet), skip it from history
    if (p.lessonId?.skill === 'writing' && p.status === 'in_progress' && (!p.attemptHistory || p.attemptHistory.length === 0)) {
      return []
    }

    const base = {
      ...new UserLessonProgressDTO(p),
      lesson: p.lessonId ? new LessonDTO(p.lessonId) : null,
    }
    const attempts = Array.isArray(p.attemptHistory) ? p.attemptHistory : []
    if (attempts.length === 0) return [base]
    return attempts.map((a) => {
      const mappedStatus =
        a.score !== null && a.score !== undefined
          ? 'completed'
          : a.type === 'writing'
          ? 'under_review'
          : 'in_progress'

      // Again, if a history attempt is writing in_progress, we might want to skip it, 
      // but usually attemptHistory only has submitted/graded items or specific save points.
      // In Writing, we only push to attemptHistory on submission.
      
      return {
        ...base,
        id: `${base.id}-attempt-${a.attemptNo || 0}`,
        status: mappedStatus,
        progress: a.progress ?? base.progress,
        score: a.score ?? base.score,
        maxScore: a.maxScore ?? base.maxScore,
        xpEarned: a.xpEarned ?? 0,
        attemptNo: a.attemptNo || 0,
        submittedAt: a.submittedAt || base.updatedAt,
      }
    })
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

// Helper to get week identifier (ISO 8601)
const getWeekIdentifier = (d) => {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 4 - (date.getDay() || 7))
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getFullYear()}-W${weekNo}`
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
      weeklyXpEarned: 0,
      lastWeeklyXpReset: new Date(),
      skillLevel: 'A1',
    })
  }

  const now = new Date()
  const currentWeek = getWeekIdentifier(now)
  const lastResetWeek = stats.lastWeeklyXpReset ? getWeekIdentifier(stats.lastWeeklyXpReset) : null

  if (currentWeek !== lastResetWeek) {
    stats.weeklyTimeSpent = 0
    stats.weeklyXpEarned = 0
  }

  // Body/API dùng giây (khớp UserLessonProgress.timeSpent); UserSkillStats lưu phút
  const minutesToAdd = (Number(timeSpent) || 0) / 60
  stats.lessonsCompleted += 1
  stats.totalTimeSpent += minutesToAdd
  stats.dailyTimeSpent += minutesToAdd
  stats.weeklyTimeSpent += minutesToAdd
  stats.totalXpEarned += xpEarned
  stats.weeklyXpEarned = (stats.weeklyXpEarned || 0) + xpEarned
  stats.lastWeeklyXpReset = now
  
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  stats.averageScore = Math.round(
    (stats.averageScore * (stats.lessonsCompleted - 1) + pct) / stats.lessonsCompleted,
  )
  if (pct > stats.highestScore) stats.highestScore = pct
  stats.lastActivityAt = now
  await stats.save()
}

/**
 * Get lesson reviews
 */
export const getLessonReviews = async (lessonId, { page = 1, limit = 10 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await LessonReview.countDocuments({ lessonId })
  const reviews = await LessonReview.find({ lessonId })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    reviews: reviews.map(r => ({
      id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      user: {
        id: r.userId?._id,
        name: r.userId?.name || 'Ẩn danh',
        avatar: r.userId?.avatar,
      }
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Add or update lesson review
 */
export const addLessonReview = async (userId, lessonId, { rating, comment }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  let review = await LessonReview.findOne({ lessonId, userId })
  let oldRating = 0

  if (review) {
    oldRating = review.rating
    review.rating = rating
    review.comment = comment
    await review.save()
  } else {
    review = await LessonReview.create({ lessonId, userId, rating, comment })
  }

  // Update lesson average rating
  const allReviews = await LessonReview.find({ lessonId }).select('rating')
  const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0)
  lesson.ratingCount = allReviews.length
  lesson.rating = lesson.ratingCount > 0 ? Number((totalRating / lesson.ratingCount).toFixed(1)) : 0
  await lesson.save()

  // Return new review obj
  await review.populate('userId', 'name avatar')
  return {
    id: review._id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: {
      id: review.userId?._id,
      name: review.userId?.name || 'Ẩn danh',
      avatar: review.userId?.avatar,
    }
  }
}

/**
 * Get all results for a specific lesson (Admin/Mod)
 */
export const getAllLessonResults = async (lessonId, { page = 1, limit = 100 }) => {
  const filter = { 
    lessonId, 
    isMockTest: { $ne: true },
    $or: [
      { status: 'completed' },
      { status: 'under_review' },
      { 'submission.submittedAt': { $exists: true } }
    ]
  }
  
  const allProgress = await UserLessonProgress.find(filter)
    .populate('userId', 'name avatar email')
    .sort({ updatedAt: -1 })
    .lean()

  // Expand results based on attemptHistory
  const expanded = []
  for (const p of allProgress) {
    const attempts = Array.isArray(p.attemptHistory) ? p.attemptHistory : []
    const user = {
      id: p.userId?._id,
      name: p.userId?.name || 'Unknown',
      avatar: p.userId?.avatar,
      email: p.userId?.email,
    }

    if (attempts.length === 0) {
      expanded.push({
        id: p._id,
        user,
        status: p.status,
        score: p.score,
        maxScore: p.maxScore,
        progress: p.progress,
        xpEarned: p.xpEarned,
        completedAt: p.completedAt || p.updatedAt,
        submission: p.submission,
        answers: [],
        attemptType: p.submission?.content ? 'writing' : 'quiz',
        attemptNo: p.attempts || 1,
        timeSpent: p.timeSpent ?? 0,
      })
    } else {
      for (const a of attempts) {
        const mappedStatus =
          a.score !== null && a.score !== undefined
            ? 'completed'
            : a.type === 'writing'
            ? 'under_review'
            : 'in_progress'

        expanded.push({
          id: `${p._id}-attempt-${a.attemptNo || 0}`,
          user,
          status: mappedStatus,
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 100,
          progress: a.progress ?? 0,
          xpEarned: a.xpEarned ?? 0,
          completedAt: a.submittedAt || p.updatedAt,
          submission: a.submission || p.submission,
          answers: a.answers || [],
          attemptType: a.type || 'quiz',
          attemptNo: a.attemptNo || 0,
          timeSpent: a.timeSpent ?? 0,
        })
      }
    }
  }

  // Final sort by completed/submitted time
  expanded.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  // Manual pagination for expanded results
  const perPage = Number(limit) || 100
  const total = expanded.length
  const { skip } = getPaginationQuery({ page, limit: perPage })
  const pageItems = expanded.slice(skip, skip + perPage)

  return {
    results: pageItems,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Fingerprint quiz grading so sync only counts attempts whose scores actually changed.
 */
function quizAttemptGradingSignature(att) {
  const answers = Array.isArray(att.answers) ? att.answers : []
  const answerSig = answers
    .map((a) => `${a.questionIndex ?? a.questionId}:${a.isCorrect ? 1 : 0}`)
    .sort()
    .join(';')
  return `${Number(att.score) || 0}|${Number(att.maxScore) || 0}|${Number(att.progress) || 0}|${answerSig}`
}

function buildGradingSignatureFromResult(score, maxScore, progressPercent, gradedAnswers) {
  const answerSig = (gradedAnswers || [])
    .map((a) => `${a.questionIndex ?? a.questionId}:${a.isCorrect ? 1 : 0}`)
    .sort()
    .join(';')
  return `${Number(score) || 0}|${Number(maxScore) || 0}|${Number(progressPercent) || 0}|${answerSig}`
}

/**
 * Re-grade quiz attempts on a single progress record (reading/listening)
 */
export function regradeProgressQuizAttempts(progress, lesson, options = {}) {
  const { beforeDate, syncTopLevel = true } = options
  const cutoffMs = beforeDate
    ? new Date(beforeDate).getTime() + 5 * 60 * 1000
    : null

  if (!lesson || !['reading', 'listening'].includes(lesson.skill)) {
    return { changed: false, updatedAttempts: 0 }
  }
  if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
    return { changed: false, updatedAttempts: 0 }
  }

  const attempts = Array.isArray(progress.attemptHistory) ? progress.attemptHistory : []
  if (attempts.length === 0) return { changed: false, updatedAttempts: 0 }

  let changed = false
  let updatedAttempts = 0
  for (const att of attempts) {
    if (att.type === 'writing') continue
    if (!Array.isArray(att.answers) || att.answers.length === 0) continue
    if (cutoffMs && att.submittedAt && new Date(att.submittedAt).getTime() > cutoffMs) continue

    const { score, maxScore, progressPercent, gradedAnswers } = gradeQuizAnswers(lesson, att.answers)
    const newSig = buildGradingSignatureFromResult(score, maxScore, progressPercent, gradedAnswers)
    if (newSig === quizAttemptGradingSignature(att)) continue

    att.type = att.type || 'quiz'
    att.score = score
    att.maxScore = maxScore
    att.progress = progressPercent
    att.answers = gradedAnswers
    updatedAttempts += 1
    changed = true
  }

  if (!changed) return { changed: false, updatedAttempts: 0 }

  if (syncTopLevel) {
    let quizAttempts = attempts.filter((a) => a.type !== 'writing' && Array.isArray(a.answers) && a.answers.length > 0)
    if (cutoffMs) {
      quizAttempts = quizAttempts.filter(
        (a) => !a.submittedAt || new Date(a.submittedAt).getTime() <= cutoffMs,
      )
    }
    if (quizAttempts.length > 0) {
      const latest = quizAttempts[quizAttempts.length - 1]
      progress.score = latest.score
      progress.maxScore = latest.maxScore
      progress.progress = latest.progress
      progress.bestScore = Math.max(
        progress.bestScore || 0,
        ...quizAttempts.map((a) => Number(a.score) || 0),
      )
      if (latest.score != null && latest.maxScore != null && latest.score >= latest.maxScore * 0.8) {
        progress.status = progress.status === 'under_review' ? progress.status : 'completed'
      }
    }
  }

  return { changed: true, updatedAttempts }
}

/**
 * Mod/admin: re-grade all quiz attempts for a reading/listening lesson
 */
export const syncLessonQuizScores = async (lessonId) => {
  let lesson = null
  if (String(lessonId).match(/^[a-f\d]{24}$/i)) {
    lesson = await Lesson.findById(lessonId)
  }
  if (!lesson) {
    lesson = await Lesson.findOne({ slug: lessonId })
  }
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  if (!['reading', 'listening'].includes(lesson.skill)) {
    throw new Error('SYNC_SKILL_NOT_SUPPORTED')
  }
  if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
    throw new Error('LESSON_NO_QUESTIONS')
  }

  const allProgress = await UserLessonProgress.find({ lessonId: lesson._id })
  let updatedUsers = 0
  let updatedAttempts = 0

  for (const progress of allProgress) {
    const { changed, updatedAttempts: attCount } = regradeProgressQuizAttempts(progress, lesson)
    if (!changed) continue
    await progress.save()
    updatedUsers += 1
    updatedAttempts += attCount
  }

  const lessonMaxScore = lesson.questions.reduce((sum, q) => sum + (q.points || 10), 0)
  if (lesson.maxScore !== lessonMaxScore) {
    lesson.maxScore = lessonMaxScore
    await lesson.save()
  }

  return {
    lessonId: lesson._id,
    skill: lesson.skill,
    updatedUsers,
    updatedAttempts,
    totalProgress: allProgress.length,
  }
}

function formatLessonProgressPayload(progress, attemptNo) {
  if (!progress) {
    return {
      notes: [],
      status: 'not_started',
      progress: 0,
      score: 0,
      maxScore: null,
      answers: [],
      xpEarned: 0,
      attempts: 0,
      submission: null,
      attemptHistory: [],
      viewAttemptNo: null,
    }
  }

  const attempts = Array.isArray(progress.attemptHistory) ? progress.attemptHistory : []
  const hasExplicitAttempt = attemptNo != null && attemptNo !== ''
  let attempt = null

  if (hasExplicitAttempt) {
    attempt = attempts.find((a) => a.attemptNo === Number(attemptNo)) || null
  } else {
    const writingAttempts = attempts.filter((a) => a.type === 'writing')
    if (writingAttempts.length > 0) {
      attempt = writingAttempts[writingAttempts.length - 1]
    } else if (attempts.length > 0) {
      attempt = attempts[attempts.length - 1]
    }
  }

  // Writing / lượt cụ thể: chỉ dùng dữ liệu trong attemptHistory, không trộn progress gốc
  const attemptScoped = Boolean(attempt && (hasExplicitAttempt || attempt.type === 'writing'))

  if (hasExplicitAttempt && !attempt) {
    return {
      notes: progress.notes || [],
      status: 'not_started',
      progress: 0,
      score: null,
      maxScore: progress.maxScore,
      answers: [],
      xpEarned: 0,
      attempts: progress.attempts || 0,
      submission: null,
      aiScore: null,
      aiFeedback: null,
      attemptHistory: attempts,
      viewAttemptNo: Number(attemptNo),
    }
  }

  if (attemptScoped && attempt) {
    const status =
      attempt.score != null && attempt.score !== undefined
        ? 'completed'
        : attempt.type === 'writing'
          ? 'under_review'
          : progress.status
    const sub = attempt.submission ?? null
    return {
      notes: progress.notes || [],
      status,
      progress: attempt.progress ?? 0,
      score: attempt.score ?? null,
      maxScore: attempt.maxScore ?? progress.maxScore,
      answers: attempt.answers || [],
      xpEarned: attempt.xpEarned ?? 0,
      attempts: progress.attempts || 0,
      submission: sub,
      aiScore: sub?.aiScore ?? null,
      aiFeedback: sub?.aiFeedback ?? null,
      attemptHistory: attempts,
      viewAttemptNo: attempt.attemptNo ?? null,
    }
  }

  let status = progress.status
  if (attempt) {
    status =
      attempt.score != null && attempt.score !== undefined
        ? 'completed'
        : attempt.type === 'writing'
          ? 'under_review'
          : progress.status
  }

  return {
    notes: progress.notes || [],
    status,
    progress: attempt?.progress ?? progress.progress,
    score: attempt?.score ?? progress.score,
    maxScore: attempt?.maxScore ?? progress.maxScore,
    answers: attempt?.answers || [],
    xpEarned: attempt?.xpEarned ?? progress.xpEarned,
    attempts: progress.attempts || 0,
    submission: attempt?.submission || progress.submission || null,
    aiScore: (attempt?.submission || progress.submission)?.aiScore ?? null,
    aiFeedback: (attempt?.submission || progress.submission)?.aiFeedback ?? null,
    attemptHistory: attempts,
    viewAttemptNo: attempt?.attemptNo ?? null,
  }
}

/**
 * Tiến độ bài học của user (tự xem hoặc mod xem học viên)
 */
export async function getLessonProgressByUser(lessonId, userId, { attemptNo } = {}) {
  let lesson = null
  if (String(lessonId).match(/^[a-f\d]{24}$/i)) {
    lesson = await Lesson.findById(lessonId).select('_id').lean()
  }
  if (!lesson) {
    lesson = await Lesson.findOne({ slug: lessonId }).select('_id').lean()
  }
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  const progress = await UserLessonProgress.findOne({
    userId,
    lessonId: lesson._id,
  }).lean()

  return formatLessonProgressPayload(progress, attemptNo)
}

/**
 * Mod/admin: get a specific user's lesson progress (optional attemptNo)
 */
export const getLessonProgressForUser = async (lessonId, targetUserId, { attemptNo } = {}) => {
  return getLessonProgressByUser(lessonId, targetUserId, { attemptNo })
}

/**
 * Moderator grades a user's writing submission
 */
export const gradeUserWriting = async (lessonId, userId, { score, feedback, attemptNo }) => {
  const progress = await UserLessonProgress.findOne({ lessonId, userId })
  if (!progress) throw new Error('PROGRESS_NOT_FOUND')

  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  const maxScore = progress.maxScore || lesson.maxScore || (lesson.questions?.reduce?.((sum, q) => sum + (q.points || 10), 0) ?? 100) || 100
  const numericScore = Number(score)
  if (Number.isNaN(numericScore)) throw new Error('INVALID_SCORE')
  const progressPercent = maxScore > 0 ? Math.round((numericScore / maxScore) * 100) : 0
  const isWriting = lesson.skill === 'writing'
  const targetAttemptNo = attemptNo != null ? Number(attemptNo) : (progress.attempts || progress.attemptHistory?.length || 1)

  const patchAttempt = (att) => {
    if (!att) return
    att.score = numericScore
    att.maxScore = maxScore
    att.progress = progressPercent
    if (isWriting) {
      att.submission = att.submission || {}
      att.submission.score = numericScore
      att.submission.feedback = feedback || ''
      att.submission.humanGraded = true
      att.submission.humanGradedAt = new Date()
    }
  }

  if (Array.isArray(progress.attemptHistory) && progress.attemptHistory.length > 0) {
    const att = progress.attemptHistory.find((a) => a.attemptNo === targetAttemptNo)
      || progress.attemptHistory[progress.attemptHistory.length - 1]
    patchAttempt(att)
  }

  const latestAttemptNo = progress.attempts || progress.attemptHistory?.length || targetAttemptNo
  if (targetAttemptNo === latestAttemptNo || attemptNo == null) {
    progress.status = 'completed'
    progress.progress = progressPercent
    progress.completedAt = progress.completedAt || new Date()
    progress.score = numericScore
    progress.maxScore = maxScore
    if (isWriting) {
      progress.submission = progress.submission || {}
      progress.submission.score = numericScore
      progress.submission.feedback = feedback || ''
      progress.submission.humanGraded = true
      progress.submission.humanGradedAt = new Date()
    }
  }

  if (numericScore > (progress.bestScore || 0)) {
    progress.bestScore = numericScore
  }

  await progress.save()

  const xpToAdd = progressPercent >= 80 ? (lesson.xpReward || 50) : 0
  if (xpToAdd > 0 && targetAttemptNo === latestAttemptNo) {
    const userAccount = await User.findById(userId)
    if (userAccount) {
      userAccount.awardXp(xpToAdd)
      userAccount.lastActiveDate = new Date()
      await userAccount.save()
    }
  }

  await updateSkillStats(userId, lesson.skill || 'reading', {
    score: numericScore,
    maxScore,
    xpEarned: xpToAdd,
    timeSpent: progress.timeSpent || 0,
  })

  if (isWriting) {
    await mockTestService.updateSessionStatusIfCompleted(progress._id)
  }

  try {
    await bumpPeriodicQuestsOnLessonEvent(
      userId,
      lesson.skill || 'reading',
      progressPercent,
      lesson.category || 'lesson'
    )
  } catch (e) {
    console.warn('[periodicQuest] grade bump:', e?.message)
  }
  try {
    await incrementChallengeProgressByRequirement(userId, 'lessons', 1)
    await incrementChallengeProgressByRequirement(userId, 'score', progressPercent)
  } catch (e) {
    console.warn('[challenge] grade bump:', e?.message)
  }

  return progress
}

function applyAiResultToSubmission(submission, aiResult) {
  if (!submission) return
  submission.aiScore = aiResult.score
  submission.aiFeedback = aiResult.feedback
  submission.aiStrengths = aiResult.strengths || []
  submission.aiImprovements = aiResult.improvements || []
  submission.aiGrammarErrors = aiResult.grammarErrors || []
  submission.aiBreakdown = aiResult.breakdown || null
}

/** Giữ nội dung bài viết khi chỉ cập nhật điểm AI (tránh submission rỗng sau save). */
function preserveSubmissionText(submission, sourceContent, sourceSubmission) {
  if (!submission) return
  if (sourceContent && !String(submission.content ?? '').trim()) {
    submission.content = sourceContent
  }
  if (!sourceSubmission) return
  if (sourceSubmission.wordCount != null && submission.wordCount == null) {
    submission.wordCount = sourceSubmission.wordCount
  }
  if (sourceSubmission.submittedAt && !submission.submittedAt) {
    submission.submittedAt = sourceSubmission.submittedAt
  }
}

async function resolveMockTestAttemptWindow(progressId, sessionCompletedAt) {
  if (!sessionCompletedAt || !progressId) return null

  const targetMs = new Date(sessionCompletedAt).getTime()
  const sessions = await MockTestResult.find({ lessonResults: progressId })
    .populate({
      path: 'lessonResults',
      populate: { path: 'lessonId', select: 'skill' },
    })
    .lean()

  if (sessions.length === 0) return null

  const session = sessions.find((s) => {
    const ms = new Date(s.completedAt).getTime()
    return Math.abs(ms - targetMs) <= 2 * 60 * 1000
  }) ?? sessions.sort(
    (a, b) => Math.abs(new Date(a.completedAt).getTime() - targetMs)
      - Math.abs(new Date(b.completedAt).getTime() - targetMs),
  )[0]

  if (!session?.lessonResults?.length) return null
  return resolveSessionAttemptWindow(session.lessonResults, sessionCompletedAt)
}

/** Resolve writing text for AI grade — mock test uses sessionCompletedAt like enrichSessionLessonResults. */
async function findWritingSubmissionSource(progress, { attemptNo, sessionCompletedAt, skill = 'writing' } = {}) {
  const attempts = Array.isArray(progress.attemptHistory) ? progress.attemptHistory : []
  const hasSession = sessionCompletedAt != null && sessionCompletedAt !== ''
  const hasAttemptNo = attemptNo != null && attemptNo !== ''
  const attemptWindow = hasSession
    ? await resolveMockTestAttemptWindow(progress._id, sessionCompletedAt)
    : null

  // Mock test: chỉ chấm attempt thuộc phiên, không fallback bài cũ
  if (hasSession) {
    if (hasAttemptNo) {
      const att = attempts.find((a) => Number(a.attemptNo) === Number(attemptNo))
      if (!att) return null
      if (attemptWindow && !isAttemptInSessionWindow(att, attemptWindow)) return null
      const content = submissionContentFromAttempt(att)
      if (!content) return null
      return { content, attempt: att, attemptNo: att.attemptNo }
    }

    const sessionAtt = pickSessionAttempt(progress, skill, sessionCompletedAt, attemptWindow)
    if (!sessionAtt) return null
    const content = submissionContentFromAttempt(sessionAtt)
    if (!content) return null
    return { content, attempt: sessionAtt, attemptNo: sessionAtt.attemptNo }
  }

  if (hasAttemptNo) {
    const att = attempts.find((a) => Number(a.attemptNo) === Number(attemptNo))
    if (!att) return null
    const content = submissionContentFromAttempt(att)
    if (!content) return null
    return { content, attempt: att, attemptNo: att.attemptNo }
  }

  const topContent = progress.submission?.content?.trim()
  if (topContent) {
    return { content: topContent, attempt: null, attemptNo: null }
  }

  for (let i = attempts.length - 1; i >= 0; i--) {
    const att = attempts[i]
    const content = submissionContentFromAttempt(att)
    if (content) {
      return { content, attempt: att, attemptNo: att.attemptNo }
    }
  }

  return null
}

/**
 * Process AI grading for a specific submission (Admin/Mod)
 */
export const aiGradeWriting = async (lessonId, userId, { attemptNo, sessionCompletedAt } = {}) => {
  const progress = await UserLessonProgress.findOne({ lessonId, userId })
  if (!progress) {
    const err = new Error('PROGRESS_NOT_FOUND')
    err.status = 404
    throw err
  }

  const lesson = await Lesson.findById(lessonId)
  if (!lesson) {
    const err = new Error('LESSON_NOT_FOUND')
    err.status = 404
    throw err
  }

  if (lesson.skill !== 'writing') {
    const err = new Error('LESSON_NOT_WRITING')
    err.status = 400
    throw err
  }

  const source = await findWritingSubmissionSource(progress, {
    attemptNo,
    sessionCompletedAt,
    skill: lesson.skill,
  })
  if (!source?.content) {
    const err = new Error('NO_SUBMISSION_CONTENT')
    err.status = 400
    throw err
  }

  const prompt = lesson.content?.prompt || lesson.title || lesson.topic || 'General Writing'

  const aiResult = await aiService.gradeWriting(prompt, source.content, {
    level: lesson.level,
    wordLimit: lesson.content?.wordLimit,
  })

  const srcSub = source.attempt?.submission

  if (!progress.submission) progress.submission = {}
  preserveSubmissionText(progress.submission, source.content, srcSub)
  applyAiResultToSubmission(progress.submission, aiResult)

  if (source.attempt) {
    if (!source.attempt.submission) source.attempt.submission = {}
    preserveSubmissionText(source.attempt.submission, source.content, srcSub)
    applyAiResultToSubmission(source.attempt.submission, aiResult)
  } else if (progress.attemptHistory.length > 0) {
    const lastWriting = [...progress.attemptHistory]
      .reverse()
      .find((a) => submissionContentFromAttempt(a))
    if (lastWriting) {
      if (!lastWriting.submission) lastWriting.submission = {}
      preserveSubmissionText(lastWriting.submission, source.content, srcSub)
      applyAiResultToSubmission(lastWriting.submission, aiResult)
    }
  }

  progress.markModified('submission')
  progress.markModified('attemptHistory')

  await progress.save()
  return progress
}
