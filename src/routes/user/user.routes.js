import { Router } from 'express'
import * as userController from '../../controllers/user.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { updateProfileSchema } from '../../validators/user.validator.js'

const router = Router()

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile (cần đăng nhập)
 * @access  Private
 */
router.get('/profile', auth, userController.getProfile)

/**
 * @route   PATCH /api/user/profile
 * @desc    Update current user profile (name, phone, bio, address, dateOfBirth, gender, avatar)
 * @access  Private
 */
router.patch('/profile', auth, validate(updateProfileSchema), userController.updateProfile)

export default router
