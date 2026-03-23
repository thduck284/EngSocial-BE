import * as authService from '../services/auth.service.js'
import * as userService from '../services/user.service.js'
import * as uploadService from '../services/upload.service.js'
import * as achievementService from '../services/achievement.service.js'
import { sendSuccess, sendError } from '../dto/index.js'
import { emitToUser } from '../config/socket.js'

/**
 * Get current user profile
 * GET /api/user/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.userId)
    return sendSuccess(res, {
      messageKey: 'auth.meSuccess',
      data: { user },
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    next(error)
  }
}

/**
 * Update current user profile
 * PATCH /api/user/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateUserProfile(req.userId, req.body)
    return sendSuccess(res, {
      messageKey: 'user.profileUpdated',
      data: { user },
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    next(error)
  }
}

/**
 * Get current user's achievements (all achievements with unlocked state)
 * GET /api/user/achievements
 */
export const getAchievements = async (req, res, next) => {
  try {
    const list = await achievementService.getAchievementsForUser(req.userId)
    return sendSuccess(res, {
      messageKey: 'user.achievementsFetched',
      data: { achievements: list },
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get public profile of another user by userId
 * GET /api/user/profile/:userId
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId
    if (req.userId === targetUserId) {
      const user = await authService.getUserById(req.userId)
      return sendSuccess(res, {
        messageKey: 'auth.meSuccess',
        data: { user },
      }, req)
    }
    const profile = await userService.getPublicProfile(req.userId, targetUserId)
    if (!profile) {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    return sendSuccess(res, {
      messageKey: 'user.profileFetched',
      data: profile,
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    next(error)
  }
}

/**
 * Get current user dashboard stats (level + skill stats)
 * GET /api/user/stats
 */
export const getStats = async (req, res, next) => {
  try {
    const data = await userService.getMyStats(req.userId)
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get current user's custom profile skills tab data
 * GET /api/user/skills-profile
 */
export const getMySkillProfile = async (req, res, next) => {
  try {
    const data = await userService.getMySkillProfile(req.userId)
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Update current user's custom profile skills tab data
 * PATCH /api/user/skills-profile
 */
export const updateMySkillProfile = async (req, res, next) => {
  try {
    const data = await userService.updateMySkillProfile(req.userId, req.body)
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Chặn user (chat 1-1)
 * POST /api/user/block/:userId
 */
export const blockUser = async (req, res, next) => {
  try {
    await userService.blockUser(req.userId, req.params.userId)
    const io = req.app.get('io')
    const blockerId = req.userId
    const blockedUserId = req.params.userId
    if (io) {
      emitToUser(io, blockerId, 'user:blocked', { blockerId, blockedUserId })
      emitToUser(io, blockedUserId, 'user:blocked', { blockerId, blockedUserId })
    }
    return sendSuccess(res, { data: { blocked: true } }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND' || error.message === 'TARGET_USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    if (error.message === 'CANNOT_BLOCK_SELF') {
      return sendError(res, { statusCode: 400, messageKey: 'user.cannotBlockSelf' }, req)
    }
    next(error)
  }
}

/**
 * Bỏ chặn user
 * DELETE /api/user/block/:userId
 */
export const unblockUser = async (req, res, next) => {
  try {
    await userService.unblockUser(req.userId, req.params.userId)
    const io = req.app.get('io')
    const blockerId = req.userId
    const unblockedUserId = req.params.userId
    if (io) {
      emitToUser(io, blockerId, 'user:unblocked', { blockerId, unblockedUserId })
      emitToUser(io, unblockedUserId, 'user:unblocked', { blockerId, unblockedUserId })
    }
    return sendSuccess(res, { data: { unblocked: true } }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    next(error)
  }
}

/**
 * Upload avatar image
 * POST /api/user/avatar (multipart/form-data, field: avatar)
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, {
        statusCode: 400,
        messageKey: 'user.avatarRequired',
      }, req)
    }

    const { user } = await uploadService.uploadAvatar(
      req.userId,
      req.file.buffer,
      req.file.mimetype
    )

    return sendSuccess(res, {
      messageKey: 'user.profileUpdated',
      data: { user },
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    next(error)
  }
}
