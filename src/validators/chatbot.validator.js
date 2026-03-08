import Joi from 'joi'

export const sendChatMessageSchema = Joi.object({
  conversationId: Joi.string().allow('', null),
  message: Joi.string().required().max(2000),
  skill: Joi.string().valid('reading', 'listening', 'writing', 'general'),
  lessonId: Joi.string(),
})
