import { Router } from 'express'
import * as userController from '../../controllers/user.controller.js'
import * as authController from '../../controllers/auth.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { uploadAvatar as uploadAvatarMw } from '../../middlewares/upload.middleware.js'
import { updateProfileSchema, updateSkillProfileSchema, changePasswordSchema, requestEmailChangeSchema, confirmEmailChangeSchema, confirmOtpSchema } from '../../validators/user.validator.js'

const router = Router()

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile (cần đăng nhập)
 * @access  Private
 */
router.get('/profile', auth, userController.getProfile)

/**
 * @route   GET /api/user/stats
 * @desc    Get current user's level + skill stats
 * @access  Private
 */
router.get('/stats', auth, userController.getStats)
router.get('/skills-profile', auth, userController.getMySkillProfile)
router.patch('/skills-profile', auth, validate(updateSkillProfileSchema), userController.updateMySkillProfile)

/**
 * @route   GET /api/user/achievements
 * @desc    Get all achievements with current user unlock state
 * @access  Private
 */
router.get('/achievements', auth, userController.getAchievements)
router.put('/achievement-stats/sync', auth, userController.syncAchievementStats)

/**
 * @route   GET /api/user/profile/:userId
 * @desc    Get public profile of another user (cần đăng nhập)
 * @access  Private
 */
router.get('/profile/:userId', auth, userController.getPublicProfile)

/**
 * @route   PATCH /api/user/profile
 * @desc    Update current user profile (name, phone, bio, address, dateOfBirth, gender, avatar)
 * @access  Private
 */
router.patch('/profile', auth, validate(updateProfileSchema), userController.updateProfile)

/**
 * @route   POST /api/user/avatar
 * @desc    Upload avatar (multipart/form-data, field: avatar)
 * @access  Private
 */
router.post('/avatar', auth, (req, res, next) => {
  uploadAvatarMw(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: req.language === 'en' ? 'File too large (max 5MB)' : 'File quá lớn (tối đa 5MB)' })
      }
      if (err.message === 'INVALID_IMAGE_TYPE') {
        return res.status(400).json({ success: false, message: req.language === 'en' ? 'Invalid image type (JPEG, PNG, GIF, WebP only)' : 'Định dạng ảnh không hợp lệ (chỉ JPEG, PNG, GIF, WebP)' })
      }
      return next(err)
    }
    next()
  })
}, userController.uploadAvatar)

router.post('/block/:userId', auth, userController.blockUser)
router.delete('/block/:userId', auth, userController.unblockUser)

/**
 * @route   POST /api/user/change-password
 * @desc    Change password (requires currentPassword + newPassword)
 * @access  Private
 */
router.post('/change-password', auth, validate(changePasswordSchema), authController.changePassword)

/**
 * @route   POST /api/user/change-email/request
 * @desc    Request OTP to change email (sends OTP to newEmail)
 * @access  Private
 */
router.post('/change-email/request', auth, validate(requestEmailChangeSchema), authController.requestEmailChange)

/**
 * @route   POST /api/user/change-email/confirm
 * @desc    Confirm email change with OTP
 * @access  Private
 */
router.post('/change-email/confirm', auth, validate(confirmEmailChangeSchema), authController.confirmEmailChange)

/**
 * @route   POST /api/user/delete-account/request
 * @desc    Send OTP to user email to confirm account deletion
 * @access  Private
 */
router.post('/delete-account/request', auth, authController.requestDeleteAccount)

/**
 * @route   POST /api/user/delete-account/confirm
 * @desc    Confirm account deletion with OTP (deletes account permanently)
 * @access  Private
 */
router.post('/delete-account/confirm', auth, validate(confirmOtpSchema), authController.confirmDeleteAccount)

export default router
