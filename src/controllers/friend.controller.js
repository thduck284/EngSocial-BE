import * as friendService from '../services/friend.service.js'
import * as notificationService from '../services/notification.service.js'
import { User } from '../models/index.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'
import { emitToUser } from '../config/socket.js'

export const sendRequest = async (req, res, next) => {
  try {
    const friendship = await friendService.sendFriendRequest(req.userId, req.params.userId)
    const receiverId = req.params.userId
    const sender = await User.findById(req.userId).select('name').lean()
    const senderName = sender?.name || 'Someone'
    const notification = await notificationService.createNotification({
      userId: receiverId,
      type: 'friend_request',
      title: 'Friend request',
      message: `${senderName} sent you a friend request`,
      fromUserId: req.userId,
      relatedId: friendship.id,
      relatedType: 'user',
      data: { friendshipId: friendship.id, fromUserName: senderName },
    })
    const io = req.app.get('io')
    if (io) {
      emitToUser(io, receiverId, 'notification', notification)
    }
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
    const recipientId = friendship.userId
    const accepterId = friendship.friendId
    const accepter = await User.findById(accepterId).select('name').lean()
    const accepterName = accepter?.name || 'Someone'
    const notification = await notificationService.createNotification({
      userId: recipientId,
      type: 'friend_request_accepted',
      title: 'Friend request accepted',
      message: `${accepterName} accepted your friend request`,
      fromUserId: accepterId,
      relatedId: friendship.id,
      relatedType: 'user',
      data: { friendshipId: friendship.id, accepterName },
    })
    const io = req.app.get('io')
    if (io) {
      emitToUser(io, recipientId, 'notification', notification)
    }

    // Achievement sync (fire-and-forget)
    import('../services/achievementUnlock.service.js').then(({ checkAndUnlockAchievements }) => {
      checkAndUnlockAchievements(recipientId, { io }).catch(() => {})
      checkAndUnlockAchievements(accepterId, { io }).catch(() => {})
    })

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

export const searchFriends = async (req, res, next) => {
  try {
    const { q, page, limit, friendFilter } = req.query
    const result = await friendService.searchUsersForFriends(req.userId, {
      q,
      page,
      limit,
      friendFilter: friendFilter || 'all',
    })
    return sendPaginated(res, {
      messageKey: 'friend.searchSuccess',
      data: result.users,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getSuggestions = async (req, res, next) => {
  try {
    const { limit } = req.query
    const suggestions = await friendService.getFriendSuggestions(req.userId, { limit })
    return sendSuccess(res, {
      data: suggestions,
    }, req)
  } catch (error) {
    next(error)
  }
}
