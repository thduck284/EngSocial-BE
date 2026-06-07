import Joi from 'joi'

/**
 * Update profile validation schema (PATCH /user/profile)
 * Tất cả trường optional; chỉ cập nhật các field gửi lên.
 */
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .messages({
      'string.min': 'Tên phải có ít nhất 2 ký tự',
      'string.max': 'Tên không được quá 100 ký tự',
    }),

  phone: Joi.string()
    .trim()
    .max(20)
    .allow('', null)
    .messages({
      'string.max': 'Số điện thoại không được quá 20 ký tự',
    }),

  bio: Joi.string()
    .max(500)
    .allow('', null)
    .messages({
      'string.max': 'Bio không được quá 500 ký tự',
    }),

  address: Joi.string()
    .trim()
    .max(300)
    .allow('', null)
    .messages({
      'string.max': 'Địa chỉ không được quá 300 ký tự',
    }),

  dateOfBirth: Joi.date()
    .max('now')
    .allow(null, '')
    .messages({
      'date.max': 'Ngày sinh không được ở tương lai',
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other')
    .allow('', null)
    .messages({
      'any.only': 'Giới tính không hợp lệ',
    }),

  avatar: Joi.string()
    .trim()
    .max(2000)
    .allow('', null)
    .messages({
      'string.max': 'Avatar URL không được quá 2000 ký tự',
    }),

  profilePrivacy: Joi.object({
    showEmail: Joi.boolean(),
    showPhone: Joi.boolean(),
    showAddress: Joi.boolean(),
    showDateOfBirth: Joi.boolean(),
    showGender: Joi.boolean(),
  }).optional(),
}).min(1).messages({
  'object.min': 'Cần ít nhất một trường để cập nhật',
})

export const updateSkillProfileSchema = Joi.object({
  skills: Joi.object().pattern(
    Joi.string(),
    Joi.string().valid('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
  ).required(),
  goals: Joi.array().items(Joi.string()).required(),
  activeView: Joi.string().valid('bars', 'radar').required(),
})

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().messages({
    'string.empty': 'Mật khẩu hiện tại là bắt buộc',
  }),
  otp: Joi.string().length(6).messages({
    'string.length': 'OTP phải gồm 6 ký tự',
    'string.empty': 'OTP là bắt buộc',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc',
  }),
}).xor('currentPassword', 'otp')

export const verifyPasswordChangeOtpSchema = Joi.object({
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP phải gồm 6 ký tự',
    'any.required': 'OTP là bắt buộc',
  }),
})

export const requestEmailChangeSchema = Joi.object({
  newEmail: Joi.string().email().required().messages({
    'string.email': 'Email không hợp lệ',
    'any.required': 'Email mới là bắt buộc',
  }),
})

export const verifyEmailChangePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
  }),
})

export const confirmEmailChangeSchema = Joi.object({
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP phải gồm 6 ký tự',
    'any.required': 'OTP là bắt buộc',
  }),
})

export const confirmOtpSchema = Joi.object({
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP phải gồm 6 ký tự',
    'any.required': 'OTP là bắt buộc',
  }),
})


