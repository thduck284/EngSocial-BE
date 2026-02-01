import { Router } from 'express'
import notificationRoutes from './notification.routes.js'
import chatbotRoutes from './chatbot.routes.js'

const router = Router()

router.use('/notifications', notificationRoutes)
router.use('/chatbot', chatbotRoutes)

export default router
