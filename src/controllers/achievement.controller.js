import * as achievementService from '../services/achievement.service.js'
import { sendSuccess, sendError } from '../dto/index.js'
import mongoose from 'mongoose'

export const getAchievements = async (req, res, next) => {
  try {
    const list = await achievementService.getAllAchievements()
    return sendSuccess(res, {
      messageKey: 'achievement.listSuccess',
      data: { achievements: list },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const createAchievement = async (req, res, next) => {
  try {
    const achievement = await achievementService.createAchievement(req.body)
    return sendSuccess(res, {
      messageKey: 'achievement.created',
      data: { achievement },
    }, req, 201)
  } catch (error) {
    next(error)
  }
}

export const updateAchievement = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, { statusCode: 400, messageKey: 'common.invalidId' }, req)
    }
    const achievement = await achievementService.updateAchievement(id, req.body)
    if (!achievement) {
      return sendError(res, { statusCode: 404, messageKey: 'achievement.notFound' }, req)
    }
    return sendSuccess(res, {
      messageKey: 'achievement.updated',
      data: { achievement },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const deleteAchievement = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, { statusCode: 400, messageKey: 'common.invalidId' }, req)
    }
    const deleted = await achievementService.deleteAchievement(id)
    if (!deleted) {
      return sendError(res, { statusCode: 404, messageKey: 'achievement.notFound' }, req)
    }
    return sendSuccess(res, { messageKey: 'achievement.deleted' }, req)
  } catch (error) {
    next(error)
  }
}
