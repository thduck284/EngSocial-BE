import Joi from 'joi'

export const createContentReportSchema = Joi.object({
  targetType: Joi.string().valid('post', 'message', 'conversation', 'user').required(),
  targetId: Joi.string().required(),
  reason: Joi.string().trim().min(1).max(120).required(),
  details: Joi.string().trim().max(2000).allow('').optional(),
})
