import Joi from 'joi'

export const updateContentReportStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'reviewed', 'dismissed').required(),
  reporterMessage: Joi.string().trim().max(5000).allow('', null).optional(),
  reportedUserMessage: Joi.string().trim().max(5000).allow('', null).optional(),
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

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'banned', 'pending').required(),
  durationValue: Joi.when('status', {
    is: Joi.valid('inactive', 'banned'),
    then: Joi.number().integer().min(1).max(3650).optional(),
    otherwise: Joi.forbidden(),
  }),
  durationUnit: Joi.when('status', {
    is: Joi.valid('inactive', 'banned'),
    then: Joi.string().valid('day', 'week', 'month', 'year').optional(),
    otherwise: Joi.forbidden(),
  }),
}).custom((value, helpers) => {
  const hasVal = value.durationValue != null
  const hasUnit = Boolean(value.durationUnit)
  if (hasVal !== hasUnit) {
    return helpers.error('any.custom', { message: 'durationValue and durationUnit must be provided together' })
  }
  return value
})
