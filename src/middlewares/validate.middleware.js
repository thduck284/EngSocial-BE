import { sendError } from '../dto/index.js'

/**
 * Validation middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    })

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }))

      return sendError(res, {
        statusCode: 400,
        messageKey: 'common.validationFailed',
        errors,
      }, req)
    }

    // Replace req.body with validated value
    req.body = value
    next()
  }
}
