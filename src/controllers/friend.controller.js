import * as friendService from '../services/friend.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const sendRequest = async (req, res, next) => {
  try {
    const friendship = await friendService.sendFriendRequest(req.userId, req.params.userId)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'friend.requestSent',
      data: { friendship },
    }, req)
  } catch (error) {
    const map = {
      CANNOT_ADD_SELF: [400, 'friend.cannotAddSelf'],
      USER_NOT_FOUND: [404, 'auth.userNotFound'],
      USER_BLOCKED: [403, 'friend.blocked'],
      REQUEST_ALREADY_SENT: [409, 'friend.alreadySent'],
      ALREADY_FRIENDS: [409, 'friend.alreadyFriends'],
    }
    const e = map[error.message]
    if (e) return sendError(res, { statusCode: e[0], messageKey: e[1] }, req)
    next(error)
  }
}

export const acceptRequest = async (req, res, next) => {
  try {
    const friendship = await friendService.acceptFriendRequest(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: 'friend.requestAccepted',
      data: { friendship },
    }, req)
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'friend.requestNotFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

export const rejectRequest = async (req, res, next) => {
  try {
    await friendService.rejectFriendRequest(req.userId, req.params.id)
    return sendSuccess(res, { messageKey: 'friend.requestRejected' }, req)
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'friend.requestNotFound' }, req)
    }
    next(error)
  }
}

export const removeFriend = async (req, res, next) => {
  try {
    await friendService.removeFriend(req.userId, req.params.userId)
    return sendSuccess(res, { messageKey: 'friend.removed' }, req)
  } catch (error) {
    if (error.message === 'NOT_FRIENDS') {
      return sendError(res, { statusCode: 404, messageKey: 'friend.notFriends' }, req)
    }
    next(error)
  }
}

export const getFriends = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await friendService.getFriends(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'friend.listSuccess',
      data: result.friends,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getPendingRequests = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await friendService.getPendingRequests(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'friend.pendingSuccess',
      data: result.requests,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getSentRequests = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await friendService.getSentRequests(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'friend.sentSuccess',
      data: result.requests,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}
