import Joi from 'joi'

export const updateContentReportStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewed', 'dismissed').required(),
})

export const adminUpdateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  email: Joi.string().email().lowercase().trim(),
  phone: Joi.string().max(20).allow('', null),
  bio: Joi.string().max(500).allow('', null),
  address: Joi.string().max(300).allow('', null),
  gender: Joi.string().valid('male', 'female', 'other', ''),
  dateOfBirth: Joi.alternatives().try(Joi.date(), Joi.string().isoDate(), Joi.allow(null, '')),
  avatar: Joi.string().max(2000).allow('', null),
})
  .min(1)
  .messages({
    'object.min': 'At least one field is required',
  })

export const adminSetPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(128).required(),
})
