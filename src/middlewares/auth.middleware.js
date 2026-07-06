import { verifyToken, loadUserAndReactivateIfExpired, isSessionTokenValid } from '../utils/index.js'
import { sendError } from '../dto/index.js'
import { User } from '../models/index.js'

/**
 * Auth middleware - verify JWT token
 */
export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.tokenNotFound',
      }, req)
    }
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    req.userId = decoded.userId

    const u = await loadUserAndReactivateIfExpired(req.userId)
    if (!u) {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.tokenInvalidOrExpired',
      }, req)
    }
    if (u.status === 'banned') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountBanned',
      }, req)
    }
    if (u.status === 'inactive') {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.accountInactive',
      }, req)
    }
    if (!isSessionTokenValid(decoded, u.sessionVersion)) {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.sessionReplaced',
      }, req)
    }

    next()
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
      messageKey: 'auth.tokenInvalidOrExpired',
    }, req)
  }
}

/**
 * Require admin or moderator — dùng cho lesson, practice, upload, word-scramble, tạo skill.
 * Phải gọi sau auth().
 */
export const requireModeratorOrAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role').lean()
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return sendError(res, {
        statusCode: 403,
        messageKey: 'auth.forbidden',
        message: 'Admin or moderator only',
      }, req)
    }
    next()
  } catch (error) {
    return sendError(res, {
      statusCode: 403,
      messageKey: 'auth.tokenInvalidOrExpired',
    }, req)
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const decoded = verifyToken(token)
      req.userId = decoded.userId
    }

    next()
  } catch (error) {
    // If token is invalid, just continue without userId
    next()
  }
}
