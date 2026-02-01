/**
 * Success response helper
 */
export const successResponse = (res, { message = 'Success', data = null, statusCode = 200 }) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data && { data }),
  })
}

/**
 * Error response helper
 */
export const errorResponse = (res, { message = 'Error', statusCode = 500, errors = null }) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  })
}
