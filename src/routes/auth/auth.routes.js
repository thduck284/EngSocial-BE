import { Router } from 'express'
import * as authController from '../../controllers/auth.controller.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { auth } from '../../middlewares/auth.middleware.js'
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  facebookLoginSchema,
  refreshTokenSchema,
  updatePreferencesSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../../validators/auth.validator.js'

const router = Router()

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), authController.register)

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(loginSchema), authController.login)

/**
 * @route   POST /api/auth/social/google
 * @desc    Login/register with Google (ID token)
 * @access  Public
 */
router.post('/social/google', validate(googleLoginSchema), authController.loginWithGoogle)

/**
 * @route   POST /api/auth/social/facebook
 * @desc    Login/register with Facebook (access token)
 * @access  Public
 */
router.post('/social/facebook', validate(facebookLoginSchema), authController.loginWithFacebook)

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refresh)

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
router.post('/logout', validate(refreshTokenSchema), authController.logout)

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', auth, authController.getMe)

/**
 * @route   PATCH /api/auth/preferences
 * @desc    Update user preferences (e.g. language)
 * @access  Private
 */
router.patch('/preferences', auth, validate(updatePreferencesSchema), authController.updatePreferences)

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset (sends link to email)
 * @access  Public
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token from email
 * @access  Public
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email with token from signup link
 * @access  Public
 */
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail)

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend signup verification email
 * @access  Public
 */
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification)

export default router
