import MockTestResult from '../models/learning/MockTestResult.js'
import UserLessonProgress from '../models/learning/UserLessonProgress.js'
import { User } from '../models/index.js'
import { regradeProgressQuizAttempts } from './lesson.service.js'

function getProgressSkill(progress, lessonsMeta = []) {
  const fromLesson = progress.lessonId?.skill
  if (fromLesson) return fromLesson
  const lessonRef = progress.lessonId?._id || progress.lessonId
  const meta = (lessonsMeta || []).find(
    (l) => String(l.lessonId?._id || l.lessonId || l.id) === String(lessonRef),
  )
  return meta?.skill || null
}

function isWritingAttempt(att) {
  if (!att) return false
  return att.type === 'writing' || (att.submission?.content != null && !Array.isArray(att.answers))
}

function isQuizAttempt(att) {
  if (!att || isWritingAttempt(att)) return false
  return Array.isArray(att.answers) && att.answers.length > 0
}

/** Latest attempt for this mock test session (ignores later retakes on the same lesson). */
function pickSessionAttempt(progress, skill, sessionCompletedAt) {
  const attempts = Array.isArray(progress.attemptHistory) ? progress.attemptHistory : []
  const cutoffMs = sessionCompletedAt
    ? new Date(sessionCompletedAt).getTime() + 5 * 60 * 1000
    : null

  const filtered = attempts.filter((att) => {
    if (skill === 'writing') return isWritingAttempt(att)
    // Include quiz attempts even when answers[] is empty (auto-submit / timer expiry)
    return att.type === 'quiz' || (Array.isArray(att.answers) && !isWritingAttempt(att))
  })

  if (filtered.length === 0) return null
  if (!cutoffMs) return filtered[filtered.length - 1]

  let chosen = null
  let chosenTime = -1
  for (const att of filtered) {
    const t = att.submittedAt ? new Date(att.submittedAt).getTime() : 0
    if (t <= cutoffMs && t >= chosenTime) {
      chosen = att
      chosenTime = t
    }
  }
  return chosen || filtered[filtered.length - 1]
}

function mapSessionParts(lessonResults = [], lessonsMeta = []) {
  if (!Array.isArray(lessonsMeta) || lessonsMeta.length === 0) {
    return lessonResults || []
  }
  return lessonsMeta
    .map((meta) => {
      const lid = meta.lessonId?._id || meta.lessonId || meta.id
      return (lessonResults || []).find(
        (p) => String(p.lessonId?._id || p.lessonId) === String(lid),
      )
    })
    .filter(Boolean)
}

/** Writing counts toward mock test total only when instructor saved the grade (never AI-only). */
function isInstructorGradedWriting(sessionAttempt) {
  if (!sessionAttempt?.submission) return false
  const sub = sessionAttempt.submission
  if (sub.score == null || sub.score === '') return false
  if (sub.humanGraded === true) return true
  // aiScore without humanGraded = AI suggestion only, not saved by instructor
  if (sub.aiScore != null) return false
  // Legacy rows before humanGraded (score set only by gradeUserWriting)
  return true
}

function isWritingPartProgress(progress, skill, sessionAttempt) {
  return skill === 'writing' || isWritingAttempt(sessionAttempt) || progress?.lessonId?.skill === 'writing'
}

function resolveWritingInstructorScore(sessionAttempt) {
  if (!isInstructorGradedWriting(sessionAttempt)) return 0
  return Number(sessionAttempt.submission.score) || 0
}

function resolvePartScore(progress, skill, sessionAttempt) {
  if (isWritingPartProgress(progress, skill, sessionAttempt)) {
    return resolveWritingInstructorScore(sessionAttempt)
  }
  const progressScore = progress.score != null && progress.score !== ''
    ? Number(progress.score) || 0
    : 0
  if (sessionAttempt?.score != null && sessionAttempt.score !== '') {
    const attemptScore = Number(sessionAttempt.score) || 0
    // Legacy/mock rows: score stored on progress when attempt answers were empty
    return attemptScore > 0 ? attemptScore : (progressScore > 0 ? progressScore : attemptScore)
  }
  return progressScore
}

function resolvePartMaxScore(progress, skill, sessionAttempt) {
  const lesson = progress.lessonId
  if (isWritingPartProgress(progress, skill, sessionAttempt)) {
    const max = Number(sessionAttempt?.maxScore) || Number(progress.maxScore) || 0
    return max > 0 ? max : 100
  }
  if (sessionAttempt?.maxScore != null && sessionAttempt.maxScore !== '') {
    return Number(sessionAttempt.maxScore) || 0
  }
  let max = Number(progress.maxScore) || 0
  const questions = lesson?.questions
  if (max === 0 && Array.isArray(questions) && questions.length > 0) {
    max = questions.reduce((sum, q) => sum + (q.points || 10), 0)
  }
  return max
}

function calcSessionTotals(lessonResults = [], lessonsMeta = [], sessionCompletedAt = null) {
  const parts = mapSessionParts(lessonResults, lessonsMeta)

  const overallScore = parts.reduce((sum, p) => {
    const skill = getProgressSkill(p, lessonsMeta)
    const sessionAttempt = pickSessionAttempt(p, skill, sessionCompletedAt)
    return sum + resolvePartScore(p, skill, sessionAttempt)
  }, 0)

  // Max always sums every part in the mock test (writing = 100 even before instructor grading)
  const maxTotalScore = parts.reduce((sum, p) => {
    const skill = getProgressSkill(p, lessonsMeta)
    const sessionAttempt = pickSessionAttempt(p, skill, sessionCompletedAt)
    return sum + resolvePartMaxScore(p, skill, sessionAttempt)
  }, 0)

  return { overallScore, maxTotalScore }
}

function resolvePartTimeSpent(progress, skill, sessionCompletedAt) {
  if (!progress) return 0
  if (skill && sessionCompletedAt) {
    const att = pickSessionAttempt(progress, skill, sessionCompletedAt)
    if (att?.timeSpent != null) {
      const sec = Number(att.timeSpent)
      if (Number.isFinite(sec) && sec >= 0) return sec
    }
  }
  const attempts = Array.isArray(progress.attemptHistory) ? progress.attemptHistory : []
  if (attempts.length > 0) {
    const last = attempts[attempts.length - 1]
    const fromLast = Number(last?.timeSpent)
    if (Number.isFinite(fromLast) && fromLast >= 0) return fromLast
  }
  return Number(progress.timeSpent) || 0
}

function resolveSessionTimeSpent(session, lessonResults = [], lessonsMeta = []) {
  const partSum = (lessonResults || []).reduce((sum, p) => {
    const skill = getProgressSkill(p, lessonsMeta)
    return sum + resolvePartTimeSpent(p, skill, session?.completedAt)
  }, 0)
  if (partSum > 0) return partSum
  const stored = Number(session?.timeSpent)
  if (Number.isFinite(stored) && stored > 0) return stored
  return 0
}

function isSessionPartGraded(progress, skill, sessionCompletedAt) {
  const att = pickSessionAttempt(progress, skill, sessionCompletedAt)
  if (isWritingPartProgress(progress, skill, att)) {
    if (!att) return false
    return isInstructorGradedWriting(att)
  }
  // Reading/listening are auto-graded in mock tests (quiz attempt exists = done)
  if (skill === 'reading' || skill === 'listening') {
    return att != null && !isWritingAttempt(att)
  }
  if (!att) return false
  return Array.isArray(att.answers) && att.answers.length > 0
}

function computeMockTestSessionStatus(lessonResults, lessonsMeta, sessionCompletedAt) {
  const parts = mapSessionParts(lessonResults, lessonsMeta)
  if (parts.length === 0) return 'completed'
  const allGraded = parts.every((p) =>
    isSessionPartGraded(p, getProgressSkill(p, lessonsMeta), sessionCompletedAt),
  )
  return allGraded ? 'graded' : 'completed'
}

function enrichSessionLessonResults(lessonResults = [], lessonsMeta = [], sessionCompletedAt = null) {
  return (lessonResults || []).map((progress) => {
    const skill = getProgressSkill(progress, lessonsMeta)
    const sessionAttempt = pickSessionAttempt(progress, skill, sessionCompletedAt)
    const writingPart = isWritingPartProgress(progress, skill, sessionAttempt)
    const instructorGraded = writingPart ? isInstructorGradedWriting(sessionAttempt) : undefined
    return {
      ...progress,
      score: resolvePartScore(progress, skill, sessionAttempt),
      maxScore: resolvePartMaxScore(progress, skill, sessionAttempt),
      timeSpent: resolvePartTimeSpent(progress, skill, sessionCompletedAt),
      answers: sessionAttempt?.answers ?? progress.answers,
      submission: sessionAttempt?.submission ?? progress.submission,
      instructorGraded,
      sessionAttemptNo: sessionAttempt?.attemptNo,
      // Session display: writing graded by instructor → show completed, not under_review from a later retake
      status: writingPart && instructorGraded ? 'completed' : progress.status,
    }
  })
}

function enrichMockTestSession(session) {
  const lessonResults = session.lessonResults || []
  const lessonsMeta = session.lessons || []
  const timeSpent = resolveSessionTimeSpent(session, lessonResults, lessonsMeta)
  const totals = lessonResults.length > 0 && Array.isArray(lessonsMeta) && lessonsMeta.length > 0
    ? calcSessionTotals(lessonResults, lessonsMeta, session.completedAt)
    : null
  const displayResults = totals
    ? enrichSessionLessonResults(lessonResults, lessonsMeta, session.completedAt)
    : lessonResults
  const sessionStatus = totals
    ? computeMockTestSessionStatus(lessonResults, lessonsMeta, session.completedAt)
    : session.status
  return {
    ...session,
    ...(totals ? { overallScore: totals.overallScore, maxTotalScore: totals.maxTotalScore } : {}),
    status: sessionStatus,
    lessonResults: displayResults,
    timeSpent,
    partTimeSpent: displayResults.map((p) => ({
      lessonId: p.lessonId?._id || p.lessonId,
      timeSpent: p.timeSpent ?? resolvePartTimeSpent(p, getProgressSkill(p, lessonsMeta), session.completedAt),
    })),
  }
}

/**
 * Record a mock test session by linking individual progress entries
 */
export const recordSession = async (userId, payload) => {
  const { lessons, timeSpent: timeSpentInput } = payload

  const progressEntries = await UserLessonProgress.find({
    userId,
    lessonId: { $in: lessons.map((l) => l.lessonId) },
  }).populate('lessonId').lean()

  const allGraded = progressEntries.every((p) => p.status === 'completed')
  const completedAt = new Date()

  const { overallScore, maxTotalScore } = calcSessionTotals(progressEntries, lessons, completedAt)
  const timeSpentFromParts = progressEntries.reduce(
    (sum, p) => sum + resolvePartTimeSpent(p, p.lessonId?.skill, completedAt),
    0,
  )
  const timeSpent = Number(timeSpentInput) > 0 ? Number(timeSpentInput) : timeSpentFromParts

  const session = await MockTestResult.create({
    userId,
    lessonResults: progressEntries.map((p) => p._id),
    lessons,
    overallScore,
    maxTotalScore,
    timeSpent,
    status: allGraded ? 'graded' : 'completed',
    completedAt,
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
      .populate('userId', 'name avatar email')
      .populate({
        path: 'lessonResults',
        populate: { path: 'lessonId', select: 'skill questions maxScore title' },
      })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ])

  return {
    data: sessions.map(enrichMockTestSession),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    },
  }
}

/**
 * Mod/admin: all mock test sessions with user info and filters
 */
export const getAllMockTestSessions = async ({
  page = 1,
  limit = 50,
  status,
  skill,
  search,
  date,
  dateFrom,
  dateTo,
} = {}) => {
  const filter = {}
  if (status && status !== 'all') filter.status = status

  if (skill && skill !== 'all') {
    filter['lessons.skill'] = skill
  }

  const parseDayStart = (ymd) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d, 0, 0, 0, 0)
  }
  const parseDayEnd = (ymd) => {
    const [y, m, d] = String(ymd).split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d, 23, 59, 59, 999)
  }

  if (date) {
    const start = parseDayStart(date)
    const end = parseDayEnd(date)
    if (start && end) filter.completedAt = { $gte: start, $lte: end }
  } else {
    const range = {}
    if (dateFrom) {
      const start = parseDayStart(dateFrom)
      if (start) range.$gte = start
    }
    if (dateTo) {
      const end = parseDayEnd(dateTo)
      if (end) range.$lte = end
    }
    if (Object.keys(range).length > 0) filter.completedAt = range
  }

  const q = String(search || '').trim()
  if (q) {
    const users = await User.find({
      $or: [
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ],
    }).select('_id').lean()
    const userIds = users.map((u) => u._id)
    if (userIds.length === 0) {
      return {
        data: [],
        pagination: { currentPage: page, totalPages: 0, total: 0 },
      }
    }
    filter.userId = { $in: userIds }
  }

  const skip = (page - 1) * limit
  const [total, sessions] = await Promise.all([
    MockTestResult.countDocuments(filter),
    MockTestResult.find(filter)
      .populate('userId', 'name avatar email')
      .populate({
        path: 'lessonResults',
        populate: { path: 'lessonId', select: 'skill questions maxScore title' },
      })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ])

  return {
    data: sessions.map(enrichMockTestSession),
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 0,
      total,
    },
  }
}

/**
 * Mod/admin: re-grade reading/listening parts only in a mock test session (writing excluded)
 */
export const syncMockTestQuizScores = async (sessionId) => {
  const session = await MockTestResult.findById(sessionId).populate({
    path: 'lessonResults',
    populate: { path: 'lessonId', select: 'skill questions title maxScore' },
  })
  if (!session) throw new Error('SESSION_NOT_FOUND')

  const quizProgress = (session.lessonResults || []).filter((progress) => {
    const skill = progress.lessonId?.skill
    return skill && ['reading', 'listening'].includes(skill)
  })

  if (quizProgress.length === 0) {
    throw new Error('SYNC_NO_QUIZ_PARTS')
  }

  const sessionCutoff = session.completedAt
  let updatedRlParts = 0
  let updatedRlAttempts = 0

  for (const progress of quizProgress) {
    const lesson = progress.lessonId
    const { changed, updatedAttempts: attCount } = regradeProgressQuizAttempts(progress, lesson, {
      beforeDate: sessionCutoff,
      syncTopLevel: false,
    })
    if (!changed) continue
    await progress.save()
    updatedRlParts += 1
    updatedRlAttempts += attCount
  }

  await session.populate({
    path: 'lessonResults',
    populate: { path: 'lessonId', select: 'skill questions title maxScore' },
  })
  const { overallScore, maxTotalScore } = calcSessionTotals(
    session.lessonResults,
    session.lessons,
    session.completedAt,
  )
  session.overallScore = overallScore
  session.maxTotalScore = maxTotalScore
  session.timeSpent = resolveSessionTimeSpent(session, session.lessonResults, session.lessons)
  session.status = computeMockTestSessionStatus(
    session.lessonResults,
    session.lessons,
    session.completedAt,
  )
  await session.save()

  return {
    sessionId: session._id,
    updatedRlParts,
    updatedRlAttempts,
    updatedParts: updatedRlParts,
    updatedAttempts: updatedRlAttempts,
    overallScore: session.overallScore,
    maxTotalScore: session.maxTotalScore,
  }
}

/**
 * Get a specific mock test session detail
 */
export const getSessionDetail = async (sessionId, userId) => {
  const session = await MockTestResult.findOne({ _id: sessionId, userId })
    .populate({
      path: 'lessonResults',
      populate: { path: 'lessonId', select: 'title skill level time questions maxScore' },
    })
    .lean()
  if (!session) return null
  return enrichMockTestSession(session)
}

/**
 * Update mock test session status when a writing part is graded
 */
export const updateSessionStatusIfCompleted = async (lessonResultId) => {
  const session = await MockTestResult.findOne({ lessonResults: lessonResultId }).populate({
    path: 'lessonResults',
    populate: { path: 'lessonId', select: 'skill questions maxScore' },
  })
  if (!session) return

  const { overallScore, maxTotalScore } = calcSessionTotals(
    session.lessonResults,
    session.lessons,
    session.completedAt,
  )
  session.overallScore = overallScore
  session.maxTotalScore = maxTotalScore
  session.status = computeMockTestSessionStatus(
    session.lessonResults,
    session.lessons,
    session.completedAt,
  )

  await session.save()
}

export { enrichMockTestSession, computeMockTestSessionStatus }
