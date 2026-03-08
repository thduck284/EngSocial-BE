import * as dailyGoalService from '../services/dailygoal.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getTodayGoals = async (req, res, next) => {
  try {
    const dailyGoal = await dailyGoalService.getTodayGoals(req.userId)
    return sendSuccess(res, {
      messageKey: 'dailyGoal.fetchSuccess',
      data: { dailyGoal },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateGoalProgress = async (req, res, next) => {
  try {
    const { goalId, increment } = req.body
    const dailyGoal = await dailyGoalService.updateGoalProgress(req.userId, goalId, increment)
    return sendSuccess(res, {
      messageKey: 'dailyGoal.progressUpdated',
      data: { dailyGoal },
    }, req)
  } catch (error) {
    if (error.message === 'GOAL_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'dailyGoal.goalNotFound' }, req)
    }
    next(error)
  }
}

export const getGoalHistory = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await dailyGoalService.getGoalHistory(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'dailyGoal.historySuccess',
      data: result.goals,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}
