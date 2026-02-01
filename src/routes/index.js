import { Router } from 'express'
import authRoutes from './auth.routes.js'
import userRoutes from './user.routes.js'
import lessonRoutes from './lesson.routes.js'
import skillRoutes from './skill.routes.js'
import challengeRoutes from './challenge.routes.js'
import gameRoutes from './game.routes.js'
import communityRoutes from './community.routes.js'
import notificationRoutes from './notification.routes.js'
import chatbotRoutes from './chatbot.routes.js'
import leaderboardRoutes from './leaderboard.routes.js'
import friendRoutes from './friend.routes.js'
import groupRoutes from './group.routes.js'

const router = Router()

// Mount routes
router.use('/auth', authRoutes)
router.use('/user', userRoutes)
router.use('/lessons', lessonRoutes)
router.use('/skills', skillRoutes)
router.use('/challenges', challengeRoutes)
router.use('/games', gameRoutes)
router.use('/community', communityRoutes)
router.use('/notifications', notificationRoutes)
router.use('/chatbot', chatbotRoutes)
router.use('/leaderboard', leaderboardRoutes)
router.use('/friends', friendRoutes)
router.use('/groups', groupRoutes)

export default router
