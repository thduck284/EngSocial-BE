import { Router } from 'express'
import * as adminController from '../../controllers/admin.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { requireAdmin, requireTeacher } from '../../middlewares/role.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  updateContentReportStatusSchema,
  adminUpdateUserSchema,
  adminSetPasswordSchema,
} from '../../validators/admin.validator.js'

const router = Router()

// User management (admin only)
router.get('/users', auth, requireAdmin, adminController.getUsers)
router.get('/users/:id', auth, requireAdmin, adminController.getUserById)
router.patch('/users/:id', auth, requireAdmin, validate(adminUpdateUserSchema), adminController.updateUserByAdmin)
router.post(
  '/users/:id/password',
  auth,
  requireAdmin,
  validate(adminSetPasswordSchema),
  adminController.setUserPasswordByAdmin
)
router.delete('/users/:id', auth, requireAdmin, adminController.deleteUserByAdmin)
router.patch('/users/:id/role', auth, requireAdmin, adminController.updateUserRole)
router.patch('/users/:id/status', auth, requireAdmin, adminController.updateUserStatus)

// Content reports (admin only) — bảng ContentReport
router.get('/reports', auth, requireAdmin, adminController.getContentReports)
router.patch(
  '/reports/:id/status',
  auth,
  requireAdmin,
  validate(updateContentReportStatusSchema),
  adminController.updateContentReportStatus
)

// Content management (teacher/admin)
router.get('/lessons', auth, requireTeacher, adminController.getAllLessons)
router.patch('/lessons/:id/status', auth, requireTeacher, adminController.updateLessonStatus)

// Social moderation (teacher/admin)
router.get('/flagged-posts', auth, requireTeacher, adminController.getFlaggedPosts)
router.patch('/posts/:id/moderate', auth, requireTeacher, adminController.moderatePost)
router.patch('/comments/:id/moderate', auth, requireTeacher, adminController.moderateComment)

// Statistics (admin only)
router.get('/stats', auth, requireAdmin, adminController.getSystemStats)

export default router
