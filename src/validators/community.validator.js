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
  sharedPostId: Joi.string(),
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
  sharedPostId: Joi.string().allow(null, ''),
}).min(1)

export const createCommentSchema = Joi.object({
  content: Joi.string().max(1000).allow('').default(''),
  images: Joi.array().items(Joi.string().max(2000)).max(10),
  video: Joi.string().max(2000).allow(''),
  audio: Joi.string().max(2000).allow(''),
  documents: Joi.array().items(documentItemSchema).max(5),
  parentId: Joi.string(),
}).custom((value, helpers) => {
  const hasText = typeof value?.content === 'string' && value.content.trim().length > 0
  const hasImages = Array.isArray(value?.images) && value.images.length > 0
  const hasDocs = Array.isArray(value?.documents) && value.documents.length > 0
  const hasVideo = typeof value?.video === 'string' && value.video.trim().length > 0
  const hasAudio = typeof value?.audio === 'string' && value.audio.trim().length > 0
  if (!hasText && !hasImages && !hasDocs && !hasVideo && !hasAudio) {
    return helpers.error('any.custom')
  }
  return value
}, 'content-or-media validation').messages({
  'any.custom': 'Content or at least one attachment is required.',
})

import { REACTION_TYPES } from '../models/social/Reaction.js'

/** Validate reaction type (like, love, haha, wow, sad, angry) */
export const setReactionSchema = Joi.object({
  reaction: Joi.string().valid(...REACTION_TYPES).required(),
})
