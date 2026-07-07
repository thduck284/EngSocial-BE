import crypto from 'crypto'
import { User, RefreshToken, PasswordResetToken, EmailVerificationToken } from '../models/auth/index.js'
import { hashPassword, comparePassword, generateTokenPair, reactivateUserIfExpired, loadUserAndReactivateIfExpired, buildFrontendUrl } from '../utils/index.js'
import { UserDTO, AuthResponseDTO, RefreshTokenResponseDTO } from '../dto/index.js'
import { indexUser } from '../config/elasticsearch/userSearch.service.js'
import { OAuth2Client } from 'google-auth-library'
import { bumpPeriodicQuestsOnLoginStreakEvent } from './userPeriodicQuest.service.js'
import { incrementChallengeProgressByRequirement } from './challenge.service.js'
import { updateUserStreakOnLogin } from '../utils/loginStreak.js'
import { emitToUser } from '../config/socket.js'

const EMAIL_VERIFY_TOKEN_TTL_MINUTES = 24 * 60
const RESEND_VERIFY_COOLDOWN_MS = 60 * 1000
const resendVerifyCooldowns = new Map()

async function createAndSendVerificationEmail(user, lang = 'vi') {
  await EmailVerificationToken.deleteMany({ userId: user._id })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + EMAIL_VERIFY_TOKEN_TTL_MINUTES)

  await EmailVerificationToken.create({
    userId: user._id,
    token,
    expiresAt,
  })

  const verifyLink = buildFrontendUrl(`/verify-email?token=${token}`)
  const { sendSignupVerificationEmail } = await import('./email.service.js')
  try {
    await sendSignupVerificationEmail(user.email, verifyLink, lang)
  } catch (_) {}
}

/**
 * Register new user
 */
export const register = async ({ email, password, name, gender, dateOfBirth }, lang = 'vi') => {
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

  await createAndSendVerificationEmail(user, lang)

  return {
    requiresEmailVerification: true,
    email: user.email,
  }
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

/** Một phiên đăng nhập — xóa refresh cũ, tăng sessionVersion, phát event kick phiên cũ */
const beginUserSession = async (userId, opts = {}) => {
  const { io, notifyReplace = true } = opts
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { sessionVersion: 1 } },
    { new: true },
  )
  if (!user) throw new Error('USER_NOT_FOUND')

  await RefreshToken.deleteMany({ userId: user._id })
  const sv = user.sessionVersion ?? 1
  const { accessToken, refreshToken } = generateTokenPair(user._id.toString(), sv)
  await issueRefreshToken(user._id, refreshToken)

  if (notifyReplace && io) {
    emitToUser(io, user._id.toString(), 'auth:sessionReplaced', { sessionVersion: sv })
  }

  return { accessToken, refreshToken, sessionVersion: sv }
}

const buildAuthResponse = async (user, opts = {}) => {
  const { accessToken, refreshToken } = await beginUserSession(user._id, opts)
  return new AuthResponseDTO({
    user,
    accessToken,
    refreshToken,
  })
}

/**
 * Login user
 */
export const login = async ({ email, password, io }) => {
  const user = await User.findOne({ email }).select('+password')
  if (!user) {
    throw new Error('INVALID_CREDENTIALS')
  }

  await reactivateUserIfExpired(user)

  if (user.status === 'banned') {
    throw new Error('ACCOUNT_BANNED')
  }
  if (user.status === 'inactive') {
    throw new Error('ACCOUNT_INACTIVE')
  }

  if ((user.provider === 'local' || !user.provider) && !user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED')
  }

  // Check password
  const isPasswordValid = await comparePassword(password, user.password)
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const { accessToken, refreshToken } = await beginUserSession(user._id, { io })

  const now = new Date()
  const { calendarAdvance } = updateUserStreakOnLogin(user, now)
  await user.save()

  if (calendarAdvance) {
    try {
      await bumpPeriodicQuestsOnLoginStreakEvent(user._id)
    } catch (e) {
      console.warn('[periodicQuest] login streak bump:', e?.message)
    }
    try {
      await incrementChallengeProgressByRequirement(user._id, 'streak', 1)
    } catch (e) {
      console.warn('[challenge] login streak bump:', e?.message)
    }
  }

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
export const loginWithGoogle = async ({ idToken, io }) => {
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

    if (user) await reactivateUserIfExpired(user)

    if (user?.status === 'banned') throw new Error('ACCOUNT_BANNED')
    if (user?.status === 'inactive') throw new Error('ACCOUNT_INACTIVE')

    const now = new Date()
    let calendarAdvance = false
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
      calendarAdvance = updateUserStreakOnLogin(user, now).calendarAdvance
      await user.save()
    } else {
      // Link provider info if missing
      if (!user.provider || user.provider === 'local') {
        // keep local as-is; don't overwrite
      } else if (user.provider === 'google' && !user.providerId) {
        user.providerId = providerId
      }
      if (!user.emailVerified) {
        user.emailVerified = true
      }
      if (picture && !user.avatar) {
        user.avatar = picture
        user.markModified('avatar')
      }
      if (user.status === 'pending') {
        user.status = 'active'
      }
      calendarAdvance = updateUserStreakOnLogin(user, now).calendarAdvance
      await user.save()
      user = await User.findById(user._id)
    }

    if (calendarAdvance) {
      try {
        await bumpPeriodicQuestsOnLoginStreakEvent(user._id)
      } catch (e) {
        console.warn('[periodicQuest] google login streak bump:', e?.message)
      }
      try {
        await incrementChallengeProgressByRequirement(user._id, 'streak', 1)
      } catch (e) {
        console.warn('[challenge] google login streak bump:', e?.message)
      }
    }
    return buildAuthResponse(user, { io })
  } catch (e) {
    if (e?.message === 'EMAIL_REQUIRED' || e?.message === 'ACCOUNT_BANNED' || e?.message === 'ACCOUNT_INACTIVE') throw e
    throw new Error('SOCIAL_TOKEN_INVALID')
  }
}

/**
 * Social login with Facebook (access token)
 */
const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v19.0'

function shouldRefreshAvatarFromFacebook(currentAvatar, picture) {
  if (!picture) return false
  if (!currentAvatar) return true
  return /ui-avatars\.com|facebook\.com|fbcdn\.net|fbsbx\.com|graph\.facebook\.com/i.test(currentAvatar)
}

async function fetchFacebookUserProfile(accessToken) {
  const base = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`

  const meUrl = new URL(`${base}/me`)
  meUrl.searchParams.set('fields', 'id,name,email')
  meUrl.searchParams.set('access_token', accessToken)
  const meRes = await fetch(meUrl.toString())
  const me = await meRes.json()
  const providerId = me?.id ? String(me.id) : ''
  if (!meRes.ok || !providerId) throw new Error('SOCIAL_TOKEN_INVALID')

  let picture = null
  try {
    const picUrl = new URL(`${base}/${providerId}/picture`)
    picUrl.searchParams.set('redirect', '0')
    picUrl.searchParams.set('type', 'large')
    picUrl.searchParams.set('access_token', accessToken)
    const picRes = await fetch(picUrl.toString())
    const pic = await picRes.json()
    picture = pic?.data?.url || null
  } catch (_) {}

  if (!picture) {
    const mePicUrl = new URL(`${base}/me`)
    mePicUrl.searchParams.set('fields', 'picture.type(large)')
    mePicUrl.searchParams.set('access_token', accessToken)
    const mePicRes = await fetch(mePicUrl.toString())
    const mePic = await mePicRes.json()
    picture = mePic?.picture?.data?.url || null
  }

  return {
    providerId,
    email: me?.email ? String(me.email).trim().toLowerCase() : `fb_${providerId}@engsocial.local`,
    name: me?.name || 'User',
    picture,
  }
}

export const loginWithFacebook = async ({ accessToken, io }) => {
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

    const { providerId, email, name, picture } = await fetchFacebookUserProfile(accessToken)

    let user = await User.findOne({
      $or: [{ provider: 'facebook', providerId }, { email }],
    })

    if (user) await reactivateUserIfExpired(user)

    if (user?.status === 'banned') throw new Error('ACCOUNT_BANNED')
    if (user?.status === 'inactive') throw new Error('ACCOUNT_INACTIVE')

    const now = new Date()
    let calendarAdvance = false
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
      calendarAdvance = updateUserStreakOnLogin(user, now).calendarAdvance
      await user.save()
    } else {
      if (user.provider === 'facebook' && !user.providerId) {
        user.providerId = providerId
      }
      if (!user.emailVerified) {
        user.emailVerified = true
      }
      if (shouldRefreshAvatarFromFacebook(user.avatar, picture)) {
        user.avatar = picture
        user.markModified('avatar')
      }
      if (user.status === 'pending') {
        user.status = 'active'
      }
      calendarAdvance = updateUserStreakOnLogin(user, now).calendarAdvance
      await user.save()
      user = await User.findById(user._id)
    }

    if (calendarAdvance) {
      try {
        await bumpPeriodicQuestsOnLoginStreakEvent(user._id)
      } catch (e) {
        console.warn('[periodicQuest] facebook login streak bump:', e?.message)
      }
      try {
        await incrementChallengeProgressByRequirement(user._id, 'streak', 1)
      } catch (e) {
        console.warn('[challenge] facebook login streak bump:', e?.message)
      }
    }
    return buildAuthResponse(user, { io })
  } catch (e) {
    if (e?.message === 'EMAIL_REQUIRED' || e?.message === 'ACCOUNT_BANNED' || e?.message === 'ACCOUNT_INACTIVE') throw e
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

  const user = await loadUserAndReactivateIfExpired(tokenDoc.userId)
  if (!user) {
    await RefreshToken.deleteOne({ _id: tokenDoc._id })
    throw new Error('INVALID_REFRESH_TOKEN')
  }
  if (user.status === 'banned') {
    await RefreshToken.deleteOne({ _id: tokenDoc._id })
    throw new Error('ACCOUNT_BANNED')
  }
  if (user.status === 'inactive') {
    await RefreshToken.deleteOne({ _id: tokenDoc._id })
    throw new Error('ACCOUNT_INACTIVE')
  }

  // Generate new access token (cùng sessionVersion hiện tại)
  const { accessToken } = generateTokenPair(tokenDoc.userId.toString(), user.sessionVersion ?? 0)

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
  if (updates.profilePrivacy !== undefined && typeof updates.profilePrivacy === 'object') {
    if (!user.profilePrivacy) user.profilePrivacy = {}
    const keys = ['showEmail', 'showPhone', 'showAddress', 'showDateOfBirth', 'showGender']
    keys.forEach((key) => {
      if (updates.profilePrivacy[key] !== undefined) {
        user.profilePrivacy[key] = Boolean(updates.profilePrivacy[key])
      }
    })
    user.markModified('profilePrivacy')
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

  const resetLink = buildFrontendUrl(`/reset-password?token=${token}`)

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

/**
 * Verify email with token from signup email link.
 */
export const verifyEmail = async ({ token, io }) => {
  const doc = await EmailVerificationToken.findOne({ token })
  if (!doc) throw new Error('VERIFY_TOKEN_INVALID')
  if (doc.expiresAt < new Date()) {
    await EmailVerificationToken.deleteOne({ _id: doc._id })
    throw new Error('VERIFY_TOKEN_EXPIRED')
  }

  const user = await User.findById(doc.userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  if (!user.emailVerified) {
    user.emailVerified = true
    if (user.status === 'pending') user.status = 'active'
    await user.save()
  }

  await EmailVerificationToken.deleteOne({ _id: doc._id })

  const { accessToken, refreshToken } = await beginUserSession(user._id, { io, notifyReplace: false })

  return new AuthResponseDTO({
    user,
    accessToken,
    refreshToken,
  })
}

/**
 * Resend signup verification email.
 */
export const resendVerificationEmail = async (email, lang = 'vi') => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return { ok: true }

  const lastSent = resendVerifyCooldowns.get(normalizedEmail)
  if (lastSent && Date.now() - lastSent < RESEND_VERIFY_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_VERIFY_COOLDOWN_MS - (Date.now() - lastSent)) / 1000)
    const err = new Error('VERIFY_RESEND_COOLDOWN')
    err.waitSec = waitSec
    throw err
  }

  const user = await User.findOne({ email: normalizedEmail })
  if (!user || user.emailVerified || (user.provider && user.provider !== 'local')) {
    return { ok: true }
  }

  resendVerifyCooldowns.set(normalizedEmail, Date.now())
  await createAndSendVerificationEmail(user, lang)
  return { ok: true, cooldownSec: Math.ceil(RESEND_VERIFY_COOLDOWN_MS / 1000) }
}

// In-memory OTP store for password change (TTL 10 minutes).
const passwordChangeOtps = new Map()
const PASSWORD_OTP_COOLDOWN_MS = 60 * 1000

function assertPasswordOtpRecord(userId, otp) {
  const record = passwordChangeOtps.get(userId)
  if (!record) throw new Error('OTP_INVALID')
  if (Date.now() > record.expiresAt) {
    passwordChangeOtps.delete(userId)
    throw new Error('OTP_EXPIRED')
  }
  if (record.otp !== otp) throw new Error('OTP_INVALID')
  return record
}

/**
 * Change password (authenticated) — verifies current password or email OTP first.
 */
export const changePassword = async (userId, { currentPassword, otp, newPassword }) => {
  const user = await User.findById(userId).select('+password')
  if (!user) throw new Error('USER_NOT_FOUND')

  if (currentPassword) {
    const valid = await comparePassword(currentPassword, user.password)
    if (!valid) throw new Error('WRONG_PASSWORD')
  } else if (otp) {
    const record = assertPasswordOtpRecord(userId, otp)
    if (!record.verified) throw new Error('OTP_NOT_VERIFIED')
    passwordChangeOtps.delete(userId)
  } else {
    throw new Error('AUTH_REQUIRED')
  }

  user.password = await hashPassword(newPassword)
  await user.save()
  return { ok: true }
}

/**
 * Request password change OTP — sends OTP to user's current email.
 */
export const requestPasswordChangeOtp = async (userId, lang = 'vi') => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  const existing = passwordChangeOtps.get(userId)
  if (existing?.lastSentAt && Date.now() - existing.lastSentAt < PASSWORD_OTP_COOLDOWN_MS) {
    const waitSec = Math.ceil((PASSWORD_OTP_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000)
    const err = new Error('OTP_COOLDOWN')
    err.waitSec = waitSec
    throw err
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 min

  passwordChangeOtps.set(userId, { otp, expiresAt, verified: false, lastSentAt: Date.now() })

  const { sendOtpEmail } = await import('./email.service.js')
  try {
    await sendOtpEmail(user.email, otp, lang, 'password_change')
  } catch (err) {
    console.error('[email] Password change OTP send failed:', err.message)
    console.log(`[email] Password change OTP for ${user.email}: ${otp}`)
  }

  return { ok: true, cooldownSec: Math.ceil(PASSWORD_OTP_COOLDOWN_MS / 1000) }
}

/**
 * Verify password change OTP (step before setting new password).
 */
export const verifyPasswordChangeOtp = async (userId, otp) => {
  const record = assertPasswordOtpRecord(userId, otp)
  record.verified = true
  passwordChangeOtps.set(userId, record)
  return { ok: true }
}

// In-memory OTP store (TTL 10 minutes). For production, use Redis.
const emailChangeOtps = new Map()
const emailChangePasswordVerified = new Map()
const EMAIL_CHANGE_VERIFY_TTL_MS = 10 * 60 * 1000

/**
 * Verify current password before allowing email change.
 */
export const verifyEmailChangePassword = async (userId, currentPassword) => {
  const user = await User.findById(userId).select('+password')
  if (!user) throw new Error('USER_NOT_FOUND')

  const valid = await comparePassword(currentPassword, user.password)
  if (!valid) throw new Error('WRONG_PASSWORD')

  emailChangePasswordVerified.set(userId, {
    verifiedAt: Date.now(),
    expiresAt: Date.now() + EMAIL_CHANGE_VERIFY_TTL_MS,
  })

  return { ok: true }
}

/**
 * Request email change — generates OTP and sends to new email.
 */
export const requestEmailChangeOtp = async (userId, newEmail, lang = 'vi') => {
  const normalizedEmail = newEmail.trim().toLowerCase()

  const verified = emailChangePasswordVerified.get(userId)
  if (!verified || Date.now() > verified.expiresAt) {
    emailChangePasswordVerified.delete(userId)
    throw new Error('PASSWORD_NOT_VERIFIED')
  }

  // Check if email already taken
  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) throw new Error('EMAIL_EXISTS')

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 min

  emailChangeOtps.set(userId, { otp, newEmail: normalizedEmail, expiresAt })

  // Send email
  const { sendOtpEmail } = await import('./email.service.js')
  try {
    await sendOtpEmail(normalizedEmail, otp, lang)
  } catch (_) {
    // Log in dev, but don't block the response
    console.log(`[email] OTP for ${normalizedEmail}: ${otp}`)
  }

  return { ok: true }
}

/**
 * Confirm email change with OTP.
 */
export const confirmEmailChange = async (userId, otp) => {
  const record = emailChangeOtps.get(userId)
  if (!record) throw new Error('OTP_INVALID')
  if (Date.now() > record.expiresAt) {
    emailChangeOtps.delete(userId)
    throw new Error('OTP_EXPIRED')
  }
  if (record.otp !== otp) throw new Error('OTP_INVALID')

  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  user.email = record.newEmail
  await user.save()
  emailChangeOtps.delete(userId)
  emailChangePasswordVerified.delete(userId)

  try {
    await indexUser({ id: user._id.toString(), name: user.name, email: user.email, updatedAt: user.updatedAt })
  } catch (_) {}

  return new UserDTO(user)
}

// In-memory OTP store for account deletion (TTL 10 minutes).
const deleteAccountOtps = new Map()

/**
 * Request account deletion OTP — sends OTP to user's current email.
 */
export const requestDeleteAccountOtp = async (userId, lang = 'vi') => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 min

  deleteAccountOtps.set(userId, { otp, expiresAt })

  const { sendOtpEmail } = await import('./email.service.js')
  try {
    await sendOtpEmail(user.email, otp, lang, 'delete_account')
  } catch (_) {
    console.log(`[email] Delete OTP for ${user.email}: ${otp}`)
  }

  return { ok: true }
}

/**
 * Confirm account deletion with OTP — deletes account and invalidates all tokens.
 */
export const confirmDeleteAccount = async (userId, otp) => {
  const record = deleteAccountOtps.get(userId)
  if (!record) throw new Error('OTP_INVALID')
  if (Date.now() > record.expiresAt) {
    deleteAccountOtps.delete(userId)
    throw new Error('OTP_EXPIRED')
  }
  if (record.otp !== otp) throw new Error('OTP_INVALID')

  deleteAccountOtps.delete(userId)

  // Invalidate all refresh tokens
  await RefreshToken.deleteMany({ userId })

  // Hard delete the user
  await User.findByIdAndDelete(userId)

  return { ok: true }
}


