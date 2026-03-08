import { Router } from 'express'
import * as notificationController from '../../controllers/notification.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', auth, notificationController.getNotifications)
router.get('/unread-count', auth, notificationController.getUnreadCount)
router.patch('/:id/read', auth, notificationController.markAsRead)
router.patch('/read-all', auth, notificationController.markAllAsRead)
router.delete('/:id', auth, notificationController.deleteNotification)

export default router
