import Joi from 'joi'

export const vocabRecentRecordSchema = Joi.object({
  topicId: Joi.string().required().trim(),
  practiceMode: Joi.string()
    .valid('detail', 'flashcard', 'learn', 'test', 'match', 'data')
    .required(),
  deck: Joi.string().allow('', null).max(120).optional(),
})
