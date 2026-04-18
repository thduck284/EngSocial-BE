import MockTestResult from '../models/learning/MockTestResult.js'
import UserLessonProgress from '../models/learning/UserLessonProgress.js'

/**
 * Record a mock test session by linking individual progress entries
 */
export const recordSession = async (userId, payload) => {
  const { results, lessons } = payload
  
  // lessons is array of { lessonId, skill, title }
  // results is array of UserLessonProgress IDs (or we can find them)
  
  // Find current progress for these lessons to get their latest status/score
  const progressEntries = await UserLessonProgress.find({
    userId,
    lessonId: { $in: lessons.map(l => l.lessonId) }
  }).populate('lessonId').lean()

  const allGraded = progressEntries.every(p => p.status === 'completed')
  const totalScore = progressEntries.reduce((sum, p) => sum + (p.score || 0), 0)
  const totalMax = progressEntries.reduce((sum, p) => sum + (p.maxScore || 0), 0)

  const session = await MockTestResult.create({
    userId,
    lessonResults: progressEntries.map(p => p._id),
    lessons: lessons,
    overallScore: totalScore,
    maxTotalScore: totalMax,
    status: allGraded ? 'graded' : 'completed',
    completedAt: new Date()
  })

  return session
}

/**
 * Get user mock test history
 */
export const getUserSessions = async (userId, { page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit
  const [total, sessions] = await Promise.all([
    MockTestResult.countDocuments({ userId }),
    MockTestResult.find({ userId })
      .populate('lessonResults')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
  ])

  return {
    data: sessions,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    }
  }
}

/**
 * Get a specific mock test session detail
 */
export const getSessionDetail = async (sessionId, userId) => {
  const session = await MockTestResult.findOne({ _id: sessionId, userId })
    .populate({
      path: 'lessonResults',
      populate: { path: 'lessonId', select: 'title skill level time questions' }
    })
  return session
}

/**
 * Update mock test session status when a writing part is graded
 */
export const updateSessionStatusIfCompleted = async (lessonResultId) => {
  // Find the MockTestResult that contains this lessonResultId
  const session = await MockTestResult.findOne({ lessonResults: lessonResultId }).populate('lessonResults')
  if (!session) return

  // Always recalculate scores (writing score was null at session creation)
  session.overallScore = session.lessonResults.reduce((sum, r) => sum + (r.score || 0), 0)
  session.maxTotalScore = session.lessonResults.reduce((sum, r) => sum + (r.maxScore || 0), 0)

  const allGraded = session.lessonResults.every(r => r.status === 'completed')
  if (allGraded) {
    session.status = 'graded'
  }

  await session.save()
}
