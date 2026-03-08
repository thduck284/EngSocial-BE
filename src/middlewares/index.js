// Export all middlewares
export { auth, optionalAuth } from './auth.middleware.js'
export { errorHandler, notFound } from './error.middleware.js'
export { locale } from './locale.middleware.js'
export { validate } from './validate.middleware.js'
export { requireRole, requireTeacher, requireAdmin } from './role.middleware.js'
