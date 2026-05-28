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

/**
 * Get active challenges
 */
export const getChallenges = async ({ type, skill, status, page = 1, limit = 10 }) => {
  const filter = {}
  if (type) filter.type = type
  if (skill) filter.skill = skill
  if (status === 'all' || status === '*') {
    /* staff list: mọi trạng thái */
  } else if (status) {
    filter.status = status
  } else {
    filter.status = 'active'
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Challenge.countDocuments(filter)
  const challenges = await Challenge.find(filter).sort({ startDate: -1 }).skip(skip).limit(perPage)

  return {
    challenges: challenges.map(c => new ChallengeDTO(c)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get challenge detail
 */
export const getChallengeById = async (challengeId) => {
  const challenge = await Challenge.findById(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  return new ChallengeDTO(challenge)
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
  if (challenge.status !== 'active') throw new Error('CHALLENGE_NOT_ACTIVE')

  const existing = await ChallengeParticipant.findOne({ challengeId, userId })
  if (existing) throw new Error('ALREADY_JOINED')

  const participant = await ChallengeParticipant.create({
    challengeId,
    userId,
    target: challenge.requirement?.target || 0,
    progress: 0,
    completed: false,
    joinedAt: new Date(),
  })

  await Challenge.findByIdAndUpdate(challengeId, { $inc: { participantCount: 1 } })
  return new ChallengeParticipantDTO(participant)
}

/**
 * Update challenge progress
 */
export const updateChallengeProgress = async (userId, challengeId, { progress }) => {
  const challenge = await Challenge.findById(challengeId)
  if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
  const now = new Date()
  if (
    challenge.status !== 'active'
    || (challenge.startDate && challenge.startDate > now)
    || (challenge.endDate && challenge.endDate < now)
  ) {
    throw new Error('CHALLENGE_NOT_ACTIVE')
  }

  let participant = await ChallengeParticipant.findOne({ challengeId, userId })
  if (!participant) {
    participant = await ChallengeParticipant.create({
      challengeId,
      userId,
      target: challenge.requirement?.target || 0,
      progress: 0,
      completed: false,
      joinedAt: now,
    })
    await Challenge.findByIdAndUpdate(challengeId, { $inc: { participantCount: 1 } })
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
      participant = await ChallengeParticipant.create({
        challengeId: challenge._id,
        userId,
        target: challenge.requirement?.target || 0,
        progress: 0,
        completed: false,
        joinedAt: now,
      })
      participantMap.set(challengeId, participant)
      await Challenge.findByIdAndUpdate(challenge._id, { $inc: { participantCount: 1 } })
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
