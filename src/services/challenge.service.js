import { Challenge, ChallengeParticipant, User } from '../models/index.js'
import { ChallengeDTO, ChallengeParticipantDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Get active challenges
 */
export const getChallenges = async ({ type, skill, status = 'active', page = 1, limit = 10 }) => {
  const filter = {}
  if (type) filter.type = type
  if (skill) filter.skill = skill
  if (status) filter.status = status

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
  const participant = await ChallengeParticipant.findOne({ challengeId, userId })
  if (!participant) throw new Error('NOT_JOINED')

  participant.progress = progress
  if (progress >= participant.target && !participant.completed) {
    participant.completed = true
    participant.completedAt = new Date()

    const challenge = await Challenge.findById(challengeId)
    if (challenge) {
      participant.xpEarned = challenge.xpReward || 0
      await Challenge.findByIdAndUpdate(challengeId, { $inc: { completedCount: 1 } })
      await User.findByIdAndUpdate(userId, {
        $inc: { xp: challenge.xpReward || 0, totalXp: challenge.xpReward || 0 },
      })
    }
  }
  await participant.save()
  return new ChallengeParticipantDTO(participant)
}

/**
 * Get user's challenge participation
 */
export const getUserChallenges = async (userId, { page = 1, limit = 10 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await ChallengeParticipant.countDocuments({ userId })
  const participants = await ChallengeParticipant.find({ userId })
    .populate('challengeId')
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    challenges: participants.map(p => ({
      ...new ChallengeParticipantDTO(p),
      challenge: p.challengeId ? new ChallengeDTO(p.challengeId) : null,
    })),
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
