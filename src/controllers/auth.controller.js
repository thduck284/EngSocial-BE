import * as authService from '../services/auth.service.js'
import { sendSuccess, sendError } from '../dto/index.js'
import { checkAndUnlockAchievements } from '../services/achievementUnlock.service.js'

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, name, gender, dateOfBirth } = req.body

    const data = await authService.register({ email, password, name, gender, dateOfBirth })

    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'auth.registerSuccess',
      data,
    }, req)
  } catch (error) {
    if (error.message === 'EMAIL_EXISTS') {
      return sendError(res, {
        statusCode: 409,
        messageKey: 'auth.emailExists',
      }, req)
    }
    next(error)
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const data = await authService.login({ email, password })

    // Fire-and-forget achievement check (streak-based)
    const userId = data?.user?.id || data?.user?._id
    if (userId) {
      const io = req.app.get('io')
      checkAndUnlockAchievements(userId, { io }).catch((e) =>
        console.warn('[achievement] login check failed:', e?.message)
      )
    }

    return sendSuccess(res, {
      messageKey: 'auth.loginSuccess',
      data,
    }, req)
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.invalidCredentials',
      }, req)
    }
    if (error.message === 'ACCOUNT_BANNED') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountBanned',
      }, req)
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountInactive',
      }, req)
    }
    next(error)
  }
}

/**
 * Social login with Google
 * POST /api/auth/social/google
 */
export const loginWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body
    const data = await authService.loginWithGoogle({ idToken })
    // Fire-and-forget achievement check
    const userId = data?.user?.id || data?.user?._id
    if (userId) {
      const io = req.app.get('io')
      checkAndUnlockAchievements(userId, { io }).catch((e) =>
        console.warn('[achievement] loginWithGoogle check failed:', e?.message)
      )
    }
    return sendSuccess(res, {
      messageKey: 'auth.loginSuccess',
      data,
    }, req)
  } catch (error) {
    if (error.message === 'ACCOUNT_BANNED') {
      return sendError(res, { statusCode: 403, messageKey: 'auth.accountBanned' }, req)
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return sendError(res, { statusCode: 403, messageKey: 'auth.accountInactive' }, req)
    }
    if (error.message === 'SOCIAL_TOKEN_INVALID') {
      return sendError(res, { statusCode: 401, messageKey: 'auth.invalidCredentials' }, req)
    }
    if (error.message === 'EMAIL_REQUIRED') {
      return sendError(res, {
        statusCode: 400,
        messageKey: 'common.validationFailed',
        errors: [{ field: 'email', message: 'Email là bắt buộc' }],
      }, req)
    }
    next(error)
  }
}

/**
 * Social login with Facebook
 * POST /api/auth/social/facebook
 */
export const loginWithFacebook = async (req, res, next) => {
  try {
    const { accessToken } = req.body
    const data = await authService.loginWithFacebook({ accessToken })
    // Fire-and-forget achievement check
    const userId = data?.user?.id || data?.user?._id
    if (userId) {
      const io = req.app.get('io')
      checkAndUnlockAchievements(userId, { io }).catch((e) =>
        console.warn('[achievement] loginWithFacebook check failed:', e?.message)
      )
    }
    return sendSuccess(res, {
      messageKey: 'auth.loginSuccess',
      data,
    }, req)
  } catch (error) {
    if (error.message === 'ACCOUNT_BANNED') {
      return sendError(res, { statusCode: 403, messageKey: 'auth.accountBanned' }, req)
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return sendError(res, { statusCode: 403, messageKey: 'auth.accountInactive' }, req)
    }
    if (error.message === 'SOCIAL_TOKEN_INVALID') {
      return sendError(res, { statusCode: 401, messageKey: 'auth.invalidCredentials' }, req)
    }
    if (error.message === 'EMAIL_REQUIRED') {
      return sendError(res, {
        statusCode: 400,
        messageKey: 'common.validationFailed',
        errors: [{ field: 'email', message: 'Email là bắt buộc' }],
      }, req)
    }
    next(error)
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    const result = await authService.refreshAccessToken(refreshToken)

    return sendSuccess(res, {
      messageKey: 'auth.refreshSuccess',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'INVALID_REFRESH_TOKEN' || error.message === 'REFRESH_TOKEN_EXPIRED') {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.refreshTokenInvalid',
      }, req)
    }
    if (error.message === 'ACCOUNT_BANNED') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountBanned',
      }, req)
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountInactive',
      }, req)
    }
    next(error)
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    await authService.logout(refreshToken)

    return sendSuccess(res, {
      messageKey: 'auth.logoutSuccess',
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    // req.userId is set by auth middleware
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
 * Update current user preferences (e.g. language)
 * PATCH /api/auth/preferences
 */
export const updatePreferences = async (req, res, next) => {
  try {
    const { language } = req.body
    const user = await authService.updateUserPreferences(req.userId, { language })

    return sendSuccess(res, {
      messageKey: 'common.success',
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
 * Forgot password - request reset link
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body
    const lang = req.language || 'vi'
    await authService.forgotPassword(email, lang)
    return sendSuccess(res, {
      messageKey: 'auth.forgotPasswordSuccess',
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body
    await authService.resetPassword({ token, newPassword })
    return sendSuccess(res, {
      messageKey: 'auth.resetPasswordSuccess',
    }, req)
  } catch (error) {
    if (error.message === 'RESET_TOKEN_INVALID' || error.message === 'RESET_TOKEN_EXPIRED') {
      return sendError(res, {
        statusCode: 400,
        messageKey: 'auth.resetTokenInvalid',
      }, req)
    }
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, {
        statusCode: 404,
        messageKey: 'auth.userNotFound',
      }, req)
    }
    next(error)
  }
}
