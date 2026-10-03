import Joi from 'joi'

/**
 * Register validation schema
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu không được quá 128 ký tự',
      'string.pattern.base': 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
      'any.required': 'Mật khẩu là bắt buộc',
    }),
  
  name: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Tên phải có ít nhất 2 ký tự',
      'string.max': 'Tên không được quá 100 ký tự',
      'any.required': 'Tên là bắt buộc',
    }),
  gender: Joi.string()
    .valid('male', 'female', 'other')
    .allow('', null)
    .messages({
      'any.only': 'Giới tính không hợp lệ',
    }),
  dateOfBirth: Joi.date()
    .max('now')
    .allow(null, '')
    .messages({
      'date.max': 'Ngày sinh không được ở tương lai',
    }),
})

/**
 * Login validation schema
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Mật khẩu là bắt buộc',
    }),
})

/**
 * Social login - Google (ID token)
 */
export const googleLoginSchema = Joi.object({
  idToken: Joi.string()
    .required()
    .messages({
      'any.required': 'idToken là bắt buộc',
    }),
})

/**
 * Social login - Facebook (access token)
 */
export const facebookLoginSchema = Joi.object({
  accessToken: Joi.string()
    .required()
    .messages({
      'any.required': 'accessToken là bắt buộc',
    }),
})

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token là bắt buộc',
    }),
})

/**
 * Change password validation schema
 */
export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Mật khẩu cũ là bắt buộc',
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu mới không được quá 128 ký tự',
      'string.pattern.base': 'Mật khẩu mới phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
      'any.required': 'Mật khẩu mới là bắt buộc',
    }),
})

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
})

/**
 * Update preferences (e.g. language) - at least one field
 */
export const updatePreferencesSchema = Joi.object({
  language: Joi.string()
    .valid('vi', 'en')
    .messages({
      'any.only': 'Ngôn ngữ phải là vi hoặc en',
    }),
}).min(1).messages({
  'object.min': 'Cần ít nhất một trường preferences',
})

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Token là bắt buộc',
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
      'string.max': 'Mật khẩu mới không được quá 128 ký tự',
      'string.pattern.base': 'Mật khẩu mới phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
      'any.required': 'Mật khẩu mới là bắt buộc',
    }),
})

/**
 * Verify email validation schema
 */
export const verifyEmailSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Token là bắt buộc',
    }),
})

/**
 * Resend verification email validation schema
 */
export const resendVerificationSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc',
    }),
})
