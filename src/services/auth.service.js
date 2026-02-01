import crypto from 'crypto'
import { User, RefreshToken, PasswordResetToken } from '../models/index.js'
import { hashPassword, comparePassword, generateTokenPair } from '../utils/index.js'
import { UserDTO, AuthResponseDTO, RefreshTokenResponseDTO } from '../dto/index.js'

/**
 * Register new user
 */
export const register = async ({ email, password, name }) => {
  // Check if email already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    throw new Error('EMAIL_EXISTS')
  }

  // Hash password
  const hashedPassword = await hashPassword(password)

  // Create user
  const user = await User.create({
    email,
    password: hashedPassword,
    name,
    status: 'active', // Auto-activate for now (skip email verification)
    emailVerified: false,
  })

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user._id.toString())

  // Save refresh token to database
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  })

  // Return user data (without password) using DTO
  return new AuthResponseDTO({
    user,
    accessToken,
    refreshToken,
  })
}

/**
 * Login user
 */
export const login = async ({ email, password }) => {
  // Find user by email (include password field)
  const user = await User.findOne({ email }).select('+password')
  
  if (!user) {
    throw new Error('INVALID_CREDENTIALS')
  }

  // Check if account is banned
  if (user.status === 'banned') {
    throw new Error('ACCOUNT_BANNED')
  }

  // Check password
  const isPasswordValid = await comparePassword(password, user.password)
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS')
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user._id.toString())

  // Save refresh token to database
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  })

  // Update last active date
  user.lastActiveDate = new Date()
  await user.save()

  // Return user data (without password) using DTO
  return new AuthResponseDTO({
    user,
    accessToken,
    refreshToken,
  })
}

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken) => {
  // Find refresh token in database
  const tokenDoc = await RefreshToken.findOne({ token: refreshToken })
  
  if (!tokenDoc) {
    throw new Error('INVALID_REFRESH_TOKEN')
  }

  // Check if token is expired (shouldn't happen due to TTL, but double check)
  if (tokenDoc.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: tokenDoc._id })
    throw new Error('REFRESH_TOKEN_EXPIRED')
  }

  // Generate new access token
  const { accessToken } = generateTokenPair(tokenDoc.userId.toString())

  return new RefreshTokenResponseDTO({ accessToken })
}

/**
 * Logout user (invalidate refresh token)
 */
export const logout = async (refreshToken) => {
  await RefreshToken.deleteOne({ token: refreshToken })
  return true
}

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  const user = await User.findById(userId)
  
  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  return new UserDTO(user)
}

/**
 * Update user preferences (e.g. language). Merges with existing preferences.
 */
export const updateUserPreferences = async (userId, updates) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  if (!user.preferences) user.preferences = {}
  if (updates.language !== undefined && ['vi', 'en'].includes(updates.language)) {
    user.preferences.language = updates.language
  }
  user.markModified('preferences')
  await user.save()
  return new UserDTO(user)
}

/**
 * Forgot password: create reset token for user by email.
 * Always returns success (no email leak). Token dùng 1 lần, hết hạn sau 5 phút.
 * Gửi email chứa link đặt lại (nếu đã cấu hình SMTP); không thì log link ra console.
 * @param {string} email
 * @param {string} [lang='vi'] - Ngôn ngữ email (từ req.language)
 */
export const forgotPassword = async (email, lang = 'vi') => {
  const user = await User.findOne({ email })
  if (!user) return { ok: true }

  await PasswordResetToken.deleteMany({ userId: user._id })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 5)

  await PasswordResetToken.create({
    userId: user._id,
    token,
    expiresAt,
  })

  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')
  const resetLink = `${baseUrl}/reset-password?token=${token}`

  const { sendPasswordResetEmail } = await import('./email.service.js')
  try {
    await sendPasswordResetEmail(user.email, resetLink, lang)
  } catch (err) {
    // Log nhưng vẫn trả success (không lộ email). Link vẫn log trong email.service nếu không có SMTP.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[dev] Reset link (email gửi lỗi):', resetLink)
    }
  }

  return { ok: true }
}

/**
 * Reset password with token.
 */
export const resetPassword = async ({ token, newPassword }) => {
  const doc = await PasswordResetToken.findOne({ token })
  if (!doc) throw new Error('RESET_TOKEN_INVALID')
  if (doc.expiresAt < new Date()) {
    await PasswordResetToken.deleteOne({ _id: doc._id })
    throw new Error('RESET_TOKEN_EXPIRED')
  }

  const user = await User.findById(doc.userId).select('+password')
  if (!user) throw new Error('USER_NOT_FOUND')

  user.password = await hashPassword(newPassword)
  await user.save()
  await PasswordResetToken.deleteOne({ _id: doc._id })

  return { ok: true }
}
