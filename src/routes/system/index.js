import { Router } from 'express'
import notificationRoutes from './notification.routes.js'
import chatbotRoutes from './chatbot.routes.js'
import adminRoutes from './admin.routes.js'

const router = Router()

router.use('/notifications', notificationRoutes)
router.use('/chatbot', chatbotRoutes)
router.use('/admin', adminRoutes)

export default router
