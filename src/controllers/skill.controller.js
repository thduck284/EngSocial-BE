import * as skillService from '../services/skill.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

export const getSkills = async (req, res, next) => {
  try {
    const skills = await skillService.getSkills()
    return sendSuccess(res, {
      messageKey: 'skill.listSuccess',
      data: { skills },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getSkillByKey = async (req, res, next) => {
  try {
    const skill = await skillService.getSkillByKey(req.params.key)
    return sendSuccess(res, {
      messageKey: 'skill.detailSuccess',
      data: { skill },
    }, req)
  } catch (error) {
    if (error.message === 'SKILL_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'skill.notFound' }, req)
    }
    next(error)
  }
}

export const createSkill = async (req, res, next) => {
  try {
    const skill = await skillService.createSkill(req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'skill.createSuccess',
      data: { skill },
    }, req)
  } catch (error) {
    if (error.message === 'SKILL_EXISTS') {
      return sendError(res, { statusCode: 409, messageKey: 'skill.exists' }, req)
    }
    next(error)
  }
}
