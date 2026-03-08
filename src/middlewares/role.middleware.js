import { User } from '../models/index.js'
import { sendError } from '../dto/index.js'

/**
 * Middleware: require specific role(s)
 * Usage: requireRole('admin') or requireRole('admin', 'moderator')
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId).select('role status')
      if (!user) {
        return sendError(res, { statusCode: 401, messageKey: 'auth.userNotFound' }, req)
      }
      if (!roles.includes(user.role)) {
        return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
      }
      req.userRole = user.role
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware: require teacher or admin
 */
export const requireTeacher = requireRole('admin', 'moderator')

/**
 * Middleware: require admin only
 */
export const requireAdmin = requireRole('admin')
