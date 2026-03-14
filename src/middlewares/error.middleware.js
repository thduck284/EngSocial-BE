import { sendError } from '../dto/index.js'

/**
 * Not found error handler
 */
export const notFound = (req, res, next) => {
  return sendError(res, {
    statusCode: 404,
    messageKey: 'common.routeNotFound',
    messageParams: { url: req.originalUrl },
  }, req)
}

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err)

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }))
    
    return sendError(res, {
      statusCode: 400,
      messageKey: 'common.validationFailed',
      errors,
    }, req)
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return sendError(res, {
      statusCode: 409,
      messageKey: 'common.fieldExists',
      messageParams: { field },
    }, req)
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, {
      statusCode: 400,
      messageKey: 'common.invalidId',
    }, req)
  }

  // Mongoose connection / buffer timeout (Atlas IP, network, or cold start)
  const isDbConnectionError =
    err.message && (
      /buffering timed out|before initial connection|ECONNREFUSED|ENOTFOUND|connection refused|MongoNetworkError/i.test(err.message) ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError'
    )
  if (isDbConnectionError) {
    return sendError(res, {
      statusCode: 503,
      message: 'Database connection failed. Check Atlas Network Access (allow 0.0.0.0/0) and MONGODB_URI.',
      errors: process.env.NODE_ENV === 'development' ? { raw: err.message } : null,
    }, req)
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, {
      statusCode: 401,
      messageKey: 'auth.tokenInvalid',
    }, req)
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, {
      statusCode: 401,
      messageKey: 'auth.tokenExpired',
    }, req)
  }

  // Default error
  return sendError(res, {
    statusCode: err.status || 500,
    ...(err.message ? { message: err.message } : { messageKey: 'common.serverError' }),
    errors: process.env.NODE_ENV === 'development' ? { stack: err.stack } : null,
  }, req)
}
