import * as authService from '../services/auth.service.js'
import * as userService from '../services/user.service.js'
import * as uploadService from '../services/upload.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

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
