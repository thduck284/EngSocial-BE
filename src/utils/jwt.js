import jwt from 'jsonwebtoken'

/**
 * Generate JWT access token
 */
export const generateAccessToken = (userId, sessionVersion = 0) => {
  return jwt.sign(
    { userId, sv: sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  )
}

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (userId, sessionVersion = 0) => {
  return jwt.sign(
    { userId, sv: sessionVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  )
}

/**
 * Verify JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    throw new Error('Invalid or expired token')
  }
}

/** Token hợp lệ khi sv trong JWT khớp sessionVersion hiện tại của user */
export function isSessionTokenValid(decoded, userSessionVersion) {
  const tokenSv = decoded?.sv ?? 0
  const userSv = userSessionVersion ?? 0
  return tokenSv === userSv
}

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = (userId, sessionVersion = 0) => {
  return {
    accessToken: generateAccessToken(userId, sessionVersion),
    refreshToken: generateRefreshToken(userId, sessionVersion),
  }
}
