/**
 * Backend messages by language (vi | en). Keys match messageKey used in sendSuccess/sendError.
 * Use getMessage(lang, key, params) for interpolation e.g. { field: 'email' }.
 */
const messages = {
  vi: {
    auth: {
      tokenNotFound: 'Không tìm thấy token xác thực',
      tokenInvalidOrExpired: 'Token không hợp lệ hoặc đã hết hạn',
      registerSuccess: 'Đăng ký thành công',
      emailExists: 'Email đã được sử dụng',
      loginSuccess: 'Đăng nhập thành công',
      invalidCredentials: 'Email hoặc mật khẩu không đúng',
      accountBanned: 'Tài khoản của bạn đã bị khóa',
      refreshSuccess: 'Làm mới token thành công',
      refreshTokenInvalid: 'Refresh token không hợp lệ hoặc đã hết hạn',
      logoutSuccess: 'Đăng xuất thành công',
      meSuccess: 'Lấy thông tin người dùng thành công',
      userNotFound: 'Không tìm thấy người dùng',
      tokenInvalid: 'Token không hợp lệ',
      tokenExpired: 'Token đã hết hạn',
      forgotPasswordSuccess: 'Nếu email tồn tại, bạn sẽ nhận hướng dẫn đặt lại mật khẩu.',
      resetPasswordSuccess: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.',
      resetTokenInvalid: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
      emailResetSubject: 'EngSocial - Đặt lại mật khẩu',
      emailResetBody: 'Bạn đã yêu cầu đặt lại mật khẩu. Nhấn vào link sau (dùng 1 lần, có hiệu lực 5 phút): {{link}}',
      emailResetBodyIntro: 'Bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới để đặt lại mật khẩu (link dùng 1 lần, có hiệu lực 5 phút).',
      emailResetLinkLabel: 'Đặt lại mật khẩu',
      emailResetCopyHint: 'Nếu nút không hoạt động, sao chép và dán link sau vào trình duyệt:',
    },
    common: {
      success: 'Thành công',
      error: 'Có lỗi xảy ra',
      validationFailed: 'Dữ liệu không hợp lệ',
      routeNotFound: 'Route {{url}} không tồn tại',
      fieldExists: '{{field}} đã tồn tại',
      invalidId: 'ID không hợp lệ',
      serverError: 'Lỗi server',
    },
  },
  en: {
    auth: {
      tokenNotFound: 'Authentication token not found',
      tokenInvalidOrExpired: 'Token is invalid or expired',
      registerSuccess: 'Registration successful',
      emailExists: 'Email is already in use',
      loginSuccess: 'Login successful',
      invalidCredentials: 'Invalid email or password',
      accountBanned: 'Your account has been suspended',
      refreshSuccess: 'Token refreshed successfully',
      refreshTokenInvalid: 'Refresh token is invalid or expired',
      logoutSuccess: 'Logout successful',
      meSuccess: 'User profile retrieved successfully',
      userNotFound: 'User not found',
      tokenInvalid: 'Invalid token',
      tokenExpired: 'Token expired',
      forgotPasswordSuccess: 'If that email exists, you will receive instructions to reset your password.',
      resetPasswordSuccess: 'Password reset successfully. Please log in.',
      resetTokenInvalid: 'Reset link is invalid or has expired.',
      emailResetSubject: 'EngSocial - Reset your password',
      emailResetBody: 'You requested a password reset. Click the link below (single use, valid for 5 minutes): {{link}}',
      emailResetBodyIntro: 'You requested a password reset. Click the button below to reset your password (link is single use, valid for 5 minutes).',
      emailResetLinkLabel: 'Reset password',
      emailResetCopyHint: 'If the button does not work, copy and paste this link into your browser:',
    },
    common: {
      success: 'Success',
      error: 'Something went wrong',
      validationFailed: 'Invalid data',
      routeNotFound: 'Route {{url}} not found',
      fieldExists: '{{field}} already exists',
      invalidId: 'Invalid ID',
      serverError: 'Server error',
    },
  },
}

const DEFAULT_LANG = 'vi'
const SUPPORTED = ['vi', 'en']

/**
 * Get message by language and key. Key format: 'auth.tokenNotFound' or 'common.validationFailed'.
 * @param {string} lang - 'vi' | 'en'
 * @param {string} key - dot path e.g. 'auth.emailExists'
 * @param {Record<string, string>} [params] - interpolation e.g. { url: '/api/foo', field: 'email' }
 * @returns {string}
 */
export function getMessage(lang, key, params = {}) {
  const l = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG
  const keys = key.split('.')
  let value = messages[l]
  for (const k of keys) {
    value = value?.[k]
  }
  if (typeof value !== 'string') {
    value = messages[DEFAULT_LANG]
    for (const k of keys) {
      value = value?.[k]
    }
  }
  const str = typeof value === 'string' ? value : key
  return Object.keys(params).reduce((s, p) => s.replace(new RegExp(`{{${p}}}`, 'g'), params[p]), str)
}

export default messages
