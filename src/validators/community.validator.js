import Joi from 'joi'

export const createPostSchema = Joi.object({
  content: Joi.string().required().max(5000),
  images: Joi.array().items(Joi.string().max(2000)).max(10),
  video: Joi.string().max(2000),
  documents: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().max(2000),
        Joi.object({ url: Joi.string().max(2000).required(), name: Joi.string().max(255).allow('') })
      )
    )
    .max(5),
  visibility: Joi.string().valid('public', 'friends', 'group', 'private').default('public'),
  groupId: Joi.string(),
  tags: Joi.array().items(Joi.string().max(50)),
  mentions: Joi.array().items(Joi.string()),
  lessonId: Joi.string(),
  challengeId: Joi.string(),
})

const documentItemSchema = Joi.alternatives().try(
  Joi.string().max(2000),
  Joi.object({ url: Joi.string().max(2000).required(), name: Joi.string().max(255).allow('') })
)
export const updatePostSchema = Joi.object({
  content: Joi.string().max(5000),
  images: Joi.array().items(Joi.string().max(2000)).max(10),
  video: Joi.string().max(2000),
  documents: Joi.array().items(documentItemSchema).max(5),
  visibility: Joi.string().valid('public', 'friends', 'group', 'private'),
  tags: Joi.array().items(Joi.string().max(50)),
  mentions: Joi.array().items(Joi.string()),
}).min(1)

export const createCommentSchema = Joi.object({
  content: Joi.string().required().max(1000),
  parentId: Joi.string(),
})

import { POST_REACTION_TYPES } from '../models/social/PostReaction.js'

/** Validate reaction type (like, love, haha, wow, sad, angry) */
export const setReactionSchema = Joi.object({
  reaction: Joi.string().valid(...POST_REACTION_TYPES).required(),
})
