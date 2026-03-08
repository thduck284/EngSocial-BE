import * as leaderboardService from '../services/leaderboard.service.js'
import { sendSuccess } from '../dto/index.js'

export const getLeaderboard = async (req, res, next) => {
  try {
    const { type, period } = req.query
    const leaderboard = await leaderboardService.getLeaderboard({ type, period })
    return sendSuccess(res, {
      messageKey: 'leaderboard.success',
      data: { leaderboard },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const generateLeaderboard = async (req, res, next) => {
  try {
    const { type } = req.body
    const leaderboard = await leaderboardService.generateLeaderboard(type)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'leaderboard.generated',
      data: { leaderboard },
    }, req)
  } catch (error) {
    next(error)
  }
}
