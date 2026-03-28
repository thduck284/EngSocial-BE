import crypto from 'crypto'
import { User, RefreshToken, PasswordResetToken } from '../models/auth/index.js'
import { hashPassword, comparePassword, generateTokenPair } from '../utils/index.js'
import { UserDTO, AuthResponseDTO, RefreshTokenResponseDTO } from '../dto/index.js'
import { indexUser } from '../config/elasticsearch/userSearch.service.js'
import { OAuth2Client } from 'google-auth-library'

/**
 * Register new user
 */
export const register = async ({ email, password, name, gender, dateOfBirth }) => {
  // Check if email already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    throw new Error('EMAIL_EXISTS')
  }

  // Hash password
  const hashedPassword = await hashPassword(password)

  // Build user payload
  const userPayload = {
    email,
    password: hashedPassword,
    name,
    status: 'active',
    emailVerified: false,
  }
  if (gender && ['male', 'female', 'other'].includes(gender)) userPayload.gender = gender
  if (dateOfBirth) userPayload.dateOfBirth = new Date(dateOfBirth)

  const user = await User.create(userPayload)
  try {
    await indexUser({ id: user._id.toString(), name: user.name, email: user.email, updatedAt: user.updatedAt })
  } catch (_) {}

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

const issueRefreshToken = async (userId, refreshToken) => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7 days
  await RefreshToken.create({
    userId,
    token: refreshToken,
    expiresAt,
  })
}

const buildAuthResponse = async (user) => {
  const { accessToken, refreshToken } = generateTokenPair(user._id.toString())
  await issueRefreshToken(user._id, refreshToken)
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
  await issueRefreshToken(user._id, refreshToken)

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
 * Social login with Google (ID token)
 */
export const loginWithGoogle = async ({ idToken }) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({
      idToken,
      ...(clientId ? { audience: clientId } : {}),
    })
    const payload = ticket.getPayload()
    const providerId = payload?.sub
    const email = payload?.email ? String(payload.email).trim().toLowerCase() : ''
    const name = payload?.name || payload?.given_name || 'User'
    const picture = payload?.picture

    if (!providerId) throw new Error('SOCIAL_TOKEN_INVALID')
    if (!email) throw new Error('EMAIL_REQUIRED')

    let user = await User.findOne({
      $or: [{ provider: 'google', providerId }, { email }],
    })

    if (user?.status === 'banned') throw new Error('ACCOUNT_BANNED')

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex') + 'Aa1'
      const hashedPassword = await hashPassword(randomPassword)
      user = await User.create({
        email,
        password: hashedPassword,
        name,
        avatar: picture,
        status: 'active',
        provider: 'google',
        providerId,
        emailVerified: true,
      })
      try {
        await indexUser({ id: user._id.toString(), name: user.name, email: user.email, updatedAt: user.updatedAt })
      } catch (_) {}
    } else {
      // Link provider info if missing
      let changed = false
      if (!user.provider || user.provider === 'local') {
        // keep local as-is; don't overwrite
      } else if (user.provider === 'google' && !user.providerId) {
        user.providerId = providerId
        changed = true
      }
      if (!user.emailVerified) {
        user.emailVerified = true
        changed = true
      }
      if (picture && !user.avatar) {
        user.avatar = picture
        user.markModified('avatar')
        changed = true
      }
      if (user.status === 'pending' || user.status === 'inactive') {
        user.status = 'active'
        changed = true
      }
      user.lastActiveDate = new Date()
      if (changed) await user.save()
      else await user.updateOne({ $set: { lastActiveDate: user.lastActiveDate } })
      user = await User.findById(user._id)
    }

    return buildAuthResponse(user)
  } catch (e) {
    if (e?.message === 'EMAIL_REQUIRED' || e?.message === 'ACCOUNT_BANNED') throw e
    throw new Error('SOCIAL_TOKEN_INVALID')
  }
}

/**
 * Social login with Facebook (access token)
 */
export const loginWithFacebook = async ({ accessToken }) => {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  const verifyViaDebug = async () => {
    if (!appId || !appSecret) return { ok: true }
    const appAccessToken = `${appId}|${appSecret}`
    const url = new URL('https://graph.facebook.com/debug_token')
    url.searchParams.set('input_token', accessToken)
    url.searchParams.set('access_token', appAccessToken)
    const r = await fetch(url.toString())
    const j = await r.json()
    const data = j?.data
    if (!r.ok || !data?.is_valid) return { ok: false }
    if (String(data.app_id || '') !== String(appId)) return { ok: false }
    return { ok: true }
  }

  try {
    const v = await verifyViaDebug()
    if (!v.ok) throw new Error('SOCIAL_TOKEN_INVALID')

    const meUrl = new URL('https://graph.facebook.com/me')
    meUrl.searchParams.set('fields', 'id,name,email,picture.type(large)')
    meUrl.searchParams.set('access_token', accessToken)
    const meRes = await fetch(meUrl.toString())
    const me = await meRes.json()
    const providerId = me?.id ? String(me.id) : ''
    const email = me?.email ? String(me.email).trim().toLowerCase() : ''
    const name = me?.name || 'User'
    const picture = me?.picture?.data?.url

    if (!meRes.ok || !providerId) throw new Error('SOCIAL_TOKEN_INVALID')
    if (!email) throw new Error('EMAIL_REQUIRED')

    let user = await User.findOne({
      $or: [{ provider: 'facebook', providerId }, { email }],
    })

    if (user?.status === 'banned') throw new Error('ACCOUNT_BANNED')

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex') + 'Aa1'
      const hashedPassword = await hashPassword(randomPassword)
      user = await User.create({
        email,
        password: hashedPassword,
        name,
        avatar: picture,
        status: 'active',
        provider: 'facebook',
        providerId,
        emailVerified: true,
      })
      try {
        await indexUser({ id: user._id.toString(), name: user.name, email: user.email, updatedAt: user.updatedAt })
      } catch (_) {}
    } else {
      let changed = false
      if (user.provider === 'facebook' && !user.providerId) {
        user.providerId = providerId
        changed = true
      }
      if (!user.emailVerified) {
        user.emailVerified = true
        changed = true
      }
      if (picture && !user.avatar) {
        user.avatar = picture
        user.markModified('avatar')
        changed = true
      }
      if (user.status === 'pending' || user.status === 'inactive') {
        user.status = 'active'
        changed = true
      }
      user.lastActiveDate = new Date()
      if (changed) await user.save()
      else await user.updateOne({ $set: { lastActiveDate: user.lastActiveDate } })
      user = await User.findById(user._id)
    }

    return buildAuthResponse(user)
  } catch (e) {
    if (e?.message === 'EMAIL_REQUIRED' || e?.message === 'ACCOUNT_BANNED') throw e
    throw new Error('SOCIAL_TOKEN_INVALID')
  }
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
 * Logout user (invalidate refresh token). Cập nhật lastActiveDate để "Hoạt động x phút trước" đúng.
 */
export const logout = async (refreshToken) => {
  const tokenDoc = await RefreshToken.findOne({ token: refreshToken }).select('userId').lean()
  await RefreshToken.deleteOne({ token: refreshToken })
  if (tokenDoc?.userId) {
    const now = new Date()
    await User.updateOne({ _id: tokenDoc.userId }, { $set: { lastAccessedAt: now, lastActiveDate: now } })
  }
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
 * Update user profile (name, phone, bio, address, dateOfBirth, gender, avatar).
 * Chỉ cập nhật các field có trong updates.
 */
export const updateUserProfile = async (userId, updates) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  if (updates.name !== undefined) user.name = updates.name.trim()
  if (updates.phone !== undefined) user.phone = updates.phone === '' ? undefined : updates.phone.trim()
  if (updates.bio !== undefined) user.bio = updates.bio === '' ? undefined : updates.bio
  if (updates.address !== undefined) user.address = updates.address === '' ? undefined : updates.address.trim()
  if (updates.dateOfBirth !== undefined) {
    user.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : null
  }
  if (updates.gender !== undefined) {
    user.gender = ['male', 'female', 'other'].includes(updates.gender) ? updates.gender : ''
  }
  if (updates.avatar !== undefined) {
    user.avatar = updates.avatar === '' ? undefined : updates.avatar
    user.markModified('avatar')
  }

  await user.save()
  const updated = await User.findById(userId)
  try {
    await indexUser({
      id: updated._id.toString(),
      name: updated.name,
      email: updated.email,
      updatedAt: updated.updatedAt,
    })
  } catch (_) {}
  return new UserDTO(updated)
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
  } catch (_) {}

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
