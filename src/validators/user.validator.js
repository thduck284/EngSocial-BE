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
}).min(1).messages({
  'object.min': 'Cần ít nhất một trường để cập nhật',
})
