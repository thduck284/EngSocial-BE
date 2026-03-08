import Joi from 'joi'

export const createPostSchema = Joi.object({
  content: Joi.string().required().max(5000),
  images: Joi.array().items(Joi.string().max(2000)).max(10),
  video: Joi.string().max(2000),
  visibility: Joi.string().valid('public', 'friends', 'group', 'private').default('public'),
  groupId: Joi.string(),
  tags: Joi.array().items(Joi.string().max(50)),
  mentions: Joi.array().items(Joi.string()),
  lessonId: Joi.string(),
  challengeId: Joi.string(),
})

export const updatePostSchema = Joi.object({
  content: Joi.string().max(5000),
  images: Joi.array().items(Joi.string().max(2000)).max(10),
  video: Joi.string().max(2000),
  visibility: Joi.string().valid('public', 'friends', 'group', 'private'),
  tags: Joi.array().items(Joi.string().max(50)),
}).min(1)

export const createCommentSchema = Joi.object({
  content: Joi.string().required().max(1000),
  parentId: Joi.string(),
})
