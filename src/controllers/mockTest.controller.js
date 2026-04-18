import * as mockTestService from '../services/mockTest.service.js'
import { sendSuccess, sendPaginated, sendError } from '../dto/index.js'

/**
 * Record a mock test session
 * POST /api/mock-tests/record
 */
export const recordSession = async (req, res, next) => {
  try {
    const { lessons } = req.body
    if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
      return sendError(res, { statusCode: 400, message: 'Lessons are required' }, req)
    }

    const session = await mockTestService.recordSession(req.userId, { lessons })
    return sendSuccess(res, { data: session }, req, 201)
  } catch (error) {
    next(error)
  }
}

/**
 * Get my mock test history
 * GET /api/mock-tests/my-history
 */
export const getMyHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const result = await mockTestService.getUserSessions(req.userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    })
    return sendPaginated(res, result, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get user mock test history (For Moderator/Admin)
 * GET /api/mock-tests/user-results/:userId
 */
export const getUserHistoryByMod = async (req, res, next) => {
  try {
    const { userId } = req.params
    const { page = 1, limit = 10 } = req.query
    const result = await mockTestService.getUserSessions(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    })
    return sendPaginated(res, result, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get a specific mock test session detail
 * GET /api/mock-tests/session/:id
 */
export const getSessionDetail = async (req, res, next) => {
  try {
    const { id } = req.params
    const session = await mockTestService.getSessionDetail(id, req.userId)
    if (!session) {
      return sendError(res, { statusCode: 404, message: 'Session not found' }, req)
    }
    return sendSuccess(res, { data: session }, req)
  } catch (error) {
    next(error)
  }
}
