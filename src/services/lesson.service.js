import { Lesson, UserLessonProgress, UserSkillStats, User, LessonReview } from '../models/index.js'
import { LessonDTO, LessonDetailDTO, UserLessonProgressDTO, UserSkillStatsDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { generateUniqueSlug } from '../utils/slug.js'
import * as aiService from './ai.service.js'
import * as mockTestService from './mockTest.service.js'
import { bumpPeriodicQuestsOnLessonEvent } from './userPeriodicQuest.service.js'
import { incrementChallengeProgressByRequirement } from './challenge.service.js'

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
    await aiGradeWriting(lessonId, userId)
    // Reload progress to get AI results
    const updatedProgress = await UserLessonProgress.findOne({ userId, lessonId })
    return new UserLessonProgressDTO(updatedProgress)
  } catch (error) {
    console.error('Auto AI grading failed:', error)
    return {
      success: true,
      status: 'under_review',
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

  // Body/API dùng giây (khớp UserLessonProgress.timeSpent); UserSkillStats lưu phút
  const minutesToAdd = (Number(timeSpent) || 0) / 60
  stats.lessonsCompleted += 1
  stats.totalTimeSpent += minutesToAdd
  stats.dailyTimeSpent += minutesToAdd
  stats.weeklyTimeSpent += minutesToAdd
  stats.totalXpEarned += xpEarned
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  stats.averageScore = Math.round(
    (stats.averageScore * (stats.lessonsCompleted - 1) + pct) / stats.lessonsCompleted,
  )
  if (pct > stats.highestScore) stats.highestScore = pct
  stats.lastActivityAt = new Date()
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
        attemptNo: 1,
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
          submission: a.submission || p.submission, // fallback if history doesn't have it
          attemptNo: a.attemptNo || 0,
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
 * Moderator grades a user's writing submission
 */
export const gradeUserWriting = async (lessonId, userId, { score, feedback }) => {
  const progress = await UserLessonProgress.findOne({ lessonId, userId })
  if (!progress) throw new Error('PROGRESS_NOT_FOUND')

  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')


  // Update progress
  const progressPercent = Math.round((score / (lesson.maxScore || 100)) * 100)
  progress.status = 'completed'
  progress.progress = progressPercent
  progress.completedAt = new Date()
  progress.score = score
  progress.maxScore = lesson.maxScore || 100
  progress.xpEarned = lesson.xpReward || 0
  
  progress.submission.score = score
  progress.submission.feedback = feedback
  
  // Update last attempt in history
  if (progress.attemptHistory.length > 0) {
    const lastAttempt = progress.attemptHistory[progress.attemptHistory.length - 1]
    if (lastAttempt.type === 'writing') {
      lastAttempt.score = score
      lastAttempt.progress = progressPercent
      lastAttempt.xpEarned = lesson.xpReward || 0
      lastAttempt.submission.score = score
      lastAttempt.submission.feedback = feedback
    }
  }

  // Update best score
  if (score > (progress.bestScore || 0)) {
    progress.bestScore = score
  }

  await progress.save()

  // Award XP if score >= 80
  const xpToAdd = (score >= 80) ? (lesson.xpReward || 50) : 0
  if (xpToAdd > 0) {
    const userAccount = await User.findById(userId)
    if (userAccount) {
      userAccount.awardXp(xpToAdd)
      userAccount.lastActiveDate = new Date()
      await userAccount.save()
    }
  }

  // Update Skill Stats
  await updateSkillStats(userId, 'writing', {
    score,
    maxScore: 100,
    xpEarned: xpToAdd,
    timeSpent: progress.timeSpent || 0
  })

  // Update Mock Test session status if this part is graded
  await mockTestService.updateSessionStatusIfCompleted(progress._id)

  try {
    await bumpPeriodicQuestsOnLessonEvent(
      userId,
      lesson.skill || 'writing',
      progressPercent,
      lesson.category || 'lesson'
    )
  } catch (e) {
    console.warn('[periodicQuest] writing grade bump:', e?.message)
  }
  try {
    await incrementChallengeProgressByRequirement(userId, 'lessons', 1)
    await incrementChallengeProgressByRequirement(userId, 'score', progressPercent)
  } catch (e) {
    console.warn('[challenge] writing grade bump:', e?.message)
  }

  return progress
}
/**
 * Process AI grading for a specific submission (Admin/Mod)
 */
export const aiGradeWriting = async (lessonId, userId) => {
  const progress = await UserLessonProgress.findOne({ lessonId, userId })
  if (!progress) throw new Error('PROGRESS_NOT_FOUND')

  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')

  const userContent = progress.submission?.content
  if (!userContent) throw new Error('NO_SUBMISSION_CONTENT')

  // Prompt for AI context - use specific prompt if available
  const prompt = lesson.content?.prompt || lesson.title || lesson.topic || 'General Writing'

  // Call AI Service with metadata
  const aiResult = await aiService.gradeWriting(prompt, userContent, {
    level: lesson.level,
    wordLimit: lesson.content?.wordLimit
  })

  // Update progress with AI suggestions
  progress.submission.aiScore = aiResult.score
  progress.submission.aiFeedback = aiResult.feedback
  progress.submission.aiStrengths = aiResult.strengths || []
  progress.submission.aiImprovements = aiResult.improvements || []
  progress.submission.aiGrammarErrors = aiResult.grammarErrors || []
  progress.submission.aiBreakdown = aiResult.breakdown || null

  // Also update last attempt in history
  if (progress.attemptHistory.length > 0) {
    const lastAttempt = progress.attemptHistory[progress.attemptHistory.length - 1]
    lastAttempt.submission.aiScore = aiResult.score
    lastAttempt.submission.aiFeedback = aiResult.feedback
    lastAttempt.submission.aiStrengths = aiResult.strengths || []
    lastAttempt.submission.aiImprovements = aiResult.improvements || []
    lastAttempt.submission.aiGrammarErrors = aiResult.grammarErrors || []
    lastAttempt.submission.aiBreakdown = aiResult.breakdown || null
  }

  await progress.save()
  return progress
}
