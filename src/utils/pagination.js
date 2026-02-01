/**
 * Generate pagination metadata
 */
export const getPagination = ({ page = 1, limit = 10, total }) => {
  const currentPage = parseInt(page)
  const perPage = parseInt(limit)
  const totalPages = Math.ceil(total / perPage)

  return {
    currentPage,
    perPage,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  }
}

/**
 * Get pagination query parameters
 */
export const getPaginationQuery = ({ page = 1, limit = 10 }) => {
  const currentPage = Math.max(1, parseInt(page))
  const perPage = Math.min(100, Math.max(1, parseInt(limit)))
  const skip = (currentPage - 1) * perPage

  return {
    skip,
    limit: perPage,
  }
}
