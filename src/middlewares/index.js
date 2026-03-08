// Export all middlewares
export { auth, optionalAuth, requireAdmin } from './auth.middleware.js'
export { errorHandler, notFound } from './error.middleware.js'
export { locale } from './locale.middleware.js'
export { validate } from './validate.middleware.js'
export { requireRole, requireTeacher } from './role.middleware.js'
