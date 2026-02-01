import * as authService from '../services/auth.service.js'
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
