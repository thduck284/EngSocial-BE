import * as challengeService from '../services/challenge.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getChallenges = async (req, res, next) => {
  try {
    const { type, skill, status, page, limit } = req.query
    const result = await challengeService.getChallenges({ type, skill, status, page, limit })
    return sendPaginated(res, {
      messageKey: 'challenge.listSuccess',
      data: result.challenges,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getChallengeById = async (req, res, next) => {
  try {
    const challenge = await challengeService.getChallengeById(req.params.id)
    return sendSuccess(res, {
      messageKey: 'challenge.detailSuccess',
      data: { challenge },
    }, req)
  } catch (error) {
    if (error.message === 'CHALLENGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'challenge.notFound' }, req)
    }
    next(error)
  }
}

export const createChallenge = async (req, res, next) => {
  try {
    const challenge = await challengeService.createChallenge(req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'challenge.createSuccess',
      data: { challenge },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const joinChallenge = async (req, res, next) => {
  try {
    const participant = await challengeService.joinChallenge(req.userId, req.params.id)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'challenge.joinSuccess',
      data: { participant },
    }, req)
  } catch (error) {
    if (error.message === 'CHALLENGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'challenge.notFound' }, req)
    }
    if (error.message === 'CHALLENGE_NOT_ACTIVE') {
      return sendError(res, { statusCode: 400, messageKey: 'challenge.notActive' }, req)
    }
    if (error.message === 'ALREADY_JOINED') {
      return sendError(res, { statusCode: 409, messageKey: 'challenge.alreadyJoined' }, req)
    }
    next(error)
  }
}

export const updateProgress = async (req, res, next) => {
  try {
    const participant = await challengeService.updateChallengeProgress(req.userId, req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'challenge.progressUpdated',
      data: { participant },
    }, req)
  } catch (error) {
    if (error.message === 'CHALLENGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'challenge.notFound' }, req)
    }
    if (error.message === 'CHALLENGE_NOT_ACTIVE') {
      return sendError(res, { statusCode: 400, messageKey: 'challenge.notActive' }, req)
    }
    next(error)
  }
}

export const getUserChallenges = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await challengeService.getUserChallenges(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'challenge.userListSuccess',
      data: result.challenges,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const registerChallengesVisit = async (req, res, next) => {
  try {
    const result = await challengeService.registerActiveChallengesVisit(req.userId)
    return sendSuccess(res, {
      messageKey: 'challenge.registerVisitSuccess',
      data: result,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getChallengeLeaderboard = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await challengeService.getChallengeLeaderboard(req.params.id, { page, limit })
    return sendPaginated(res, {
      messageKey: 'challenge.leaderboardSuccess',
      data: result.leaderboard,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateChallenge = async (req, res, next) => {
  try {
    const challenge = await challengeService.updateChallenge(req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'challenge.updateSuccess',
      data: { challenge },
    }, req)
  } catch (error) {
    if (error.message === 'CHALLENGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'challenge.notFound' }, req)
    }
    next(error)
  }
}

export const deleteChallenge = async (req, res, next) => {
  try {
    await challengeService.deleteChallenge(req.params.id)
    return sendSuccess(res, { messageKey: 'challenge.deleteSuccess' }, req)
  } catch (error) {
    if (error.message === 'CHALLENGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'challenge.notFound' }, req)
    }
    next(error)
  }
}
