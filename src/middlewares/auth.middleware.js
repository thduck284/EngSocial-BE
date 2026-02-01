import { verifyToken } from '../utils/index.js'
import { sendError } from '../dto/index.js'

/**
 * Auth middleware - verify JWT token
 */
export const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, {
        statusCode: 401,
        messageKey: 'auth.tokenNotFound',
      }, req)
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token)

    // Attach userId to request
    req.userId = decoded.userId

    next()
  } catch (error) {
    return sendError(res, {
      statusCode: 401,
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
