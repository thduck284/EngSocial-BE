import Lesson from '../models/learning/Lesson.js'
import { LessonDTO } from '../dto/learning/response/lesson.response.js'
import { sendSuccess, sendPaginated } from '../dto/index.js'

/**
 * Get practices list (từ Lesson với category=practice)
 * GET /api/practices?skill=reading&level=B2&topic=Business&status=published&page=1&limit=10
 */
export const getPractices = async (req, res, next) => {
  try {
    const { skill, level, topic, status = 'published', page = 1, limit = 10 } = req.query

    if (!skill || !['reading', 'listening', 'writing'].includes(skill)) {
      return sendPaginated(res, {
        data: [],
        pagination: { currentPage: 1, perPage: 10, total: 0, totalPages: 0 },
      }, req)
    }

    const filter = { skill, status, category: 'practice' }
    if (level) filter.level = level
    if (topic) filter.topic = new RegExp(topic, 'i')

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
    const skip = (pageNum - 1) * limitNum

    const [total, practices] = await Promise.all([
      Lesson.countDocuments(filter),
      Lesson.find(filter)
        .sort({ order: 1, rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ])

    const data = practices.map((p) => new LessonDTO(p).toJSON())
    const totalPages = Math.ceil(total / limitNum)
    return sendPaginated(res, {
      data,
      pagination: { currentPage: pageNum, perPage: limitNum, total, totalPages },
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get games list - from DB or empty
 * GET /api/practices/games
 */
export const getGames = async (req, res) => {
  return sendSuccess(res, { data: { games: [], hotGames: [] } }, req)
}

/**
 * Get practices config (filters, challenge) - UI config
 * GET /api/practices/fallback?skill=reading
 */
export const getFallback = async (req, res) => {
  return sendSuccess(res, { data: { filters: [], challenge: null, cards: [] } }, req)
}
