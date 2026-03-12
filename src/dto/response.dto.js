import { getMessage } from '../locales/messages.js'

/**
 * Resolve message from req.language: use messageKey + messageParams if provided, else use message.
 * @param {object} [req] - request (req.language = 'vi' | 'en')
 * @param {{ messageKey?: string, messageParams?: object, message?: string }} options
 * @returns {string}
 */
function resolveMessage(req, options) {
  if (options.messageKey && req?.language) {
    return getMessage(req.language, options.messageKey, options.messageParams || {})
  }
  return options.message != null ? options.message : (req?.language === 'en' ? 'Success' : 'Thành công')
}

function resolveErrorMessage(req, options) {
  if (options.messageKey && req?.language) {
    return getMessage(req.language, options.messageKey, options.messageParams || {})
  }
  return options.message != null ? options.message : (req?.language === 'en' ? 'Something went wrong' : 'Có lỗi xảy ra')
}

/**
 * Standard API Response wrapper
 */
export class ApiResponse {
  constructor({ success, message, data = null, errors = null, meta = null }) {
    this.success = success
    this.message = message

    if (data !== null) {
      this.data = data
    }

    if (errors !== null) {
      this.errors = errors
    }

    if (meta !== null) {
      this.meta = meta
    }
  }

  /**
   * Success response
   */
  static success({ message = 'Thành công', data = null, meta = null }) {
    return new ApiResponse({
      success: true,
      message,
      data,
      meta,
    })
  }

  /**
   * Error response (data optional, e.g. existingConversationId khi nhóm trùng thành viên)
   */
  static error({ message = 'Có lỗi xảy ra', errors = null, data = null }) {
    return new ApiResponse({
      success: false,
      message,
      errors,
      data,
    })
  }

  /**
   * Paginated response
   */
  static paginated({ message = 'Thành công', data, pagination }) {
    return new ApiResponse({
      success: true,
      message,
      data,
      meta: { pagination },
    })
  }
}

/**
 * Send success response. Pass req and messageKey to use language-based message.
 * sendSuccess(res, { messageKey: 'auth.registerSuccess', data }, req)
 */
export const sendSuccess = (res, options = {}, req = null) => {
  const { statusCode = 200, messageKey, messageParams, message, data, meta } = options
  const resolvedMessage = resolveMessage(req, { messageKey, messageParams, message })
  return res.status(statusCode).json(
    ApiResponse.success({ message: resolvedMessage, data, meta })
  )
}

/**
 * Send error response. Pass req and messageKey to use language-based message.
 * sendError(res, { statusCode: 401, messageKey: 'auth.tokenNotFound' }, req)
 */
export const sendError = (res, options = {}, req = null) => {
  const { statusCode = 500, messageKey, messageParams, message, errors, data } = options
  const resolvedMessage = resolveErrorMessage(req, { messageKey, messageParams, message })
  return res.status(statusCode).json(
    ApiResponse.error({ message: resolvedMessage, errors, data })
  )
}

/**
 * Send paginated response. Pass req and messageKey for language-based message.
 */
export const sendPaginated = (res, options = {}, req = null) => {
  const { statusCode = 200, messageKey, messageParams, message, data, pagination } = options
  const resolvedMessage = resolveMessage(req, { messageKey, messageParams, message })
  return res.status(statusCode).json(
    ApiResponse.paginated({ message: resolvedMessage, data, pagination })
  )
}
