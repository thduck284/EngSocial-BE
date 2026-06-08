import { Challenge, ChallengeParticipant, User } from '../models/index.js'
import { ChallengeDTO, ChallengeParticipantDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

async function awardChallengeCompletion(participant, challenge, userId) {
  if (!challenge) return
  participant.xpEarned = challenge.xpReward || 0
  await Challenge.findByIdAndUpdate(challenge._id, { $inc: { completedCount: 1 } })
  const user = await User.findById(userId)
  if (user) {
    user.awardXp(challenge.xpReward || 0)
    await user.save()
  }
}

/** Đếm thật từ ChallengeParticipant (không tin số hard-code trên document Challenge). */
async function getChallengeStatsMap(challengeIds) {
  const ids = (challengeIds || []).filter(Boolean)
  if (!ids.length) {
    return { participants: new Map(), completed: new Map() }
  }

  const [participantAgg, completedAgg] = await Promise.all([
    ChallengeParticipant.aggregate([
      { $match: { challengeId: { $in: ids } } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]),
    ChallengeParticipant.aggregate([
      { $match: { challengeId: { $in: ids }, completed: true } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]),
  ])

  return {
    participants: new Map(participantAgg.map((r) => [r._id.toString(), r.count])),
    completed: new Map(completedAgg.map((r) => [r._id.toString(), r.count])),
  }
}

function toChallengeDTO(challenge, stats) {
  const id = challenge._id?.toString?.() || challenge.id
  const dto = new ChallengeDTO(challenge)
  if (stats) {
    dto.participantCount = stats.participants.get(id) ?? 0
    dto.completedCount = stats.completed.get(id) ?? 0
  }
  return dto
}

function isChallengeLive(challenge, now = new Date()) {
  if (!challenge || challenge.status !== 'active') return false
  if (challenge.startDate && challenge.startDate > now) return false
  if (challenge.endDate && challenge.endDate < now) return false
  return true
}

/** Tạo ChallengeParticipant nếu chưa có — mỗi user/challenge chỉ 1 lần. */
async function ensureChallengeParticipant(userId, challenge, { requireNew = false } = {}) {
  const challengeId = challenge._id ?? challenge.id
  const existing = await ChallengeParticipant.findOne({ challengeId, userId })
  if (existing) {
    if (requireNew) throw new Error('ALREADY_JOINED')
    return { participant: existing, created: false }
  }

  try {
    const participant = await ChallengeParticipant.create({
      challengeId,
      userId,
      target: challenge.requirement?.target || 0,
      progress: 0,
      completed: false,
      joinedAt: new Date(),
    })
    await Challenge.findByIdAndUpdate(challengeId, { $inc: { participantCount: 1 } })
    return { participant, created: true }
  } catch (err) {
    if (err?.code === 11000) {
      const dup = await ChallengeParticipant.findOne({ challengeId, userId })
      if (requireNew) throw new Error('ALREADY_JOINED')
      return { participant: dup, created: false }
    }
    throw err
  }
}

/**
 * Khi user mở /challenge: đăng ký tham gia mọi thử thách đang mở (mỗi user/challenge +1 lần).
 */
export const registerActiveChallengesVisit = async (userId) => {
  const now = new Date()
  const activeChallenges = await Challenge.find({
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select('_id requirement')
    .lean()

  let registered = 0
  for (const challenge of activeChallenges) {
    const { created } = await ensureChallengeParticipant(userId, challenge)
    if (created) registered += 1
  }

  return { registered, totalActive: activeChallenges.length }
}

/**
 * Get active challenges
 */
export const getChallenges = async ({ type, skill, status, page = 1, limit = 10 }) => {
  const filter = {}
  if (type) filter.type = type
  if (skill) filter.skill = skill

  const isStaffList = status === 'all' || status === '*'
  const now = new Date()

  if (isStaffList) {
    /* staff list: mọi trạng thái */
  } else if (status) {
    filter.status = status
    if (status === 'active') {
      filter.startDate = { $lte: now }
      filter.endDate = { $gte: now }
    }
  } else {
    filter.status = 'active'
    filter.startDate = { $lte: now }
    filter.endDate = { $gte: now }
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Challenge.countDocuments(filter)
  const challenges = await Challenge.find(filter).sort({ endDate: 1, startDate: -1 }).skip(skip).limit(perPage)
  const stats = await getChallengeStatsMap(challenges.map((c) => c._id))

  return {
    challenges: challenges.map((c) => toChallengeDTO(c, stats)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get challenge detail
 */
export const getChallengeById = async (challengeId) => {
  const challenge = await Challenge.findById(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  const stats = await getChallengeStatsMap([challenge._id])
  return toChallengeDTO(challenge, stats)
}

/**
 * Create challenge (admin/teacher)
 */
export const createChallenge = async (data) => {
  const challenge = await Challenge.create(data)
  return new ChallengeDTO(challenge)
}

/**
 * Update challenge (admin)
 */
export const updateChallenge = async (challengeId, data) => {
  const challenge = await Challenge.findByIdAndUpdate(
    challengeId,
    { $set: data },
    { new: true, runValidators: true }
  )
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  return new ChallengeDTO(challenge)
}

/**
 * Delete challenge (admin)
 */
export const deleteChallenge = async (challengeId) => {
  const challenge = await Challenge.findByIdAndDelete(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  await ChallengeParticipant.deleteMany({ challengeId })
  return true
}

/**
 * Join a challenge
 */
export const joinChallenge = async (userId, challengeId) => {
  const challenge = await Challenge.findById(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  if (!isChallengeLive(challenge)) throw new Error('CHALLENGE_NOT_ACTIVE')

  const { participant } = await ensureChallengeParticipant(userId, challenge, { requireNew: true })
  return new ChallengeParticipantDTO(participant)
}

/**
 * Update challenge progress
 */
export const updateChallengeProgress = async (userId, challengeId, { progress }) => {
  const challenge = await Challenge.findById(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  if (!isChallengeLive(challenge)) throw new Error('CHALLENGE_NOT_ACTIVE')

  let participant = await ChallengeParticipant.findOne({ challengeId, userId })
  if (!participant) {
    const ensured = await ensureChallengeParticipant(userId, challenge)
    participant = ensured.participant
  }

  const nextProgress = Number(progress)
  participant.progress = Number.isFinite(nextProgress) ? nextProgress : participant.progress
  if (participant.progress >= participant.target && !participant.completed) {
    participant.completed = true
    participant.completedAt = new Date()
    await awardChallengeCompletion(participant, challenge, userId)
  }
  await participant.save()
  return new ChallengeParticipantDTO(participant)
}

/**
 * Auto bump progress for active joined challenges by requirement type.
 * Used by domain events (lesson completion, online time, login streak, etc.)
 */
export const incrementChallengeProgressByRequirement = async (userId, requirementType, delta = 1) => {
  const inc = Number(delta)
  if (!Number.isFinite(inc) || inc <= 0) return 0

  const now = new Date()
  const activeChallenges = await Challenge.find({
    status: 'active',
    'requirement.type': requirementType,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select('_id xpReward requirement')
    .lean()
  if (!activeChallenges.length) return 0

  const challengeMap = new Map(activeChallenges.map((c) => [c._id.toString(), c]))
  const participants = await ChallengeParticipant.find({
    userId,
    challengeId: { $in: activeChallenges.map((c) => c._id) },
  })
  const participantMap = new Map(participants.map((p) => [p.challengeId.toString(), p]))

  let updatedCount = 0
  for (const challenge of activeChallenges) {
    const challengeId = challenge._id.toString()
    let participant = participantMap.get(challengeId)
    if (!participant) {
      const ensured = await ensureChallengeParticipant(userId, challenge)
      participant = ensured.participant
      participantMap.set(challengeId, participant)
    }
    if (participant.completed) continue

    const challengeDoc = challengeMap.get(challengeId)
    if (!challengeDoc) continue
    participant.progress = (Number(participant.progress) || 0) + inc
    if (participant.progress >= participant.target && !participant.completed) {
      participant.completed = true
      participant.completedAt = new Date()
      await awardChallengeCompletion(participant, challengeDoc, userId)
    }
    await participant.save()
    updatedCount += 1
  }

  return updatedCount
}

/**
 * Get user's challenge participation
 */
export const getUserChallenges = async (userId, { page = 1, limit = 10 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const now = new Date()

  const [participants, activeChallenges] = await Promise.all([
    ChallengeParticipant.find({ userId })
      .populate('challengeId')
      .sort({ joinedAt: -1 })
      .lean(),
    Challenge.find({
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ endDate: 1, createdAt: -1 })
      .lean(),
  ])

  const mergedByChallengeId = new Map()

  for (const p of participants) {
    const cid = p.challengeId?._id?.toString?.() || p.challengeId?.toString?.()
    if (!cid || mergedByChallengeId.has(cid)) continue
    mergedByChallengeId.set(cid, {
      ...new ChallengeParticipantDTO(p),
      challenge: p.challengeId ? new ChallengeDTO(p.challengeId) : null,
    })
  }

  for (const c of activeChallenges) {
    const cid = c._id.toString()
    if (mergedByChallengeId.has(cid)) continue
    mergedByChallengeId.set(cid, {
      challengeId: cid,
      userId,
      progress: 0,
      target: c.requirement?.target || 0,
      completed: false,
      xpEarned: 0,
      joinedAt: null,
      completedAt: null,
      challenge: new ChallengeDTO(c),
    })
  }

  const merged = Array.from(mergedByChallengeId.values())
  const stats = await getChallengeStatsMap(
    merged.map((row) => row.challenge?._id || row.challenge?.id || row.challengeId).filter(Boolean),
  )
  for (const row of merged) {
    if (row.challenge) {
      row.challenge = toChallengeDTO(row.challenge, stats)
    }
  }

  const total = merged.length
  const rows = merged.slice(skip, skip + perPage)

  return {
    challenges: rows,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get challenge leaderboard
 */
export const getChallengeLeaderboard = async (challengeId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await ChallengeParticipant.countDocuments({ challengeId })
  const participants = await ChallengeParticipant.find({ challengeId })
    .populate('userId', 'name avatar level')
    .sort({ progress: -1, completedAt: 1 })
    .skip(skip)
    .limit(perPage)

  return {
    leaderboard: participants.map((p, idx) => ({
      rank: skip + idx + 1,
      user: p.userId ? { id: p.userId._id, name: p.userId.name, avatar: p.userId.avatar, level: p.userId.level } : null,
      progress: p.progress,
      target: p.target,
      completed: p.completed,
      xpEarned: p.xpEarned,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}
