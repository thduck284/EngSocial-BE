import { Router } from 'express'
import authRoutes from './auth/index.js'
import userRoutes from './user/index.js'
import uploadRoutes from './upload.routes.js'
import learningRoutes from './learning/index.js'
import gamificationRoutes from './gamification/index.js'
import socialRoutes from './social/index.js'
import systemRoutes from './system/index.js'

const router = Router()

// Mount routes by module
router.use('/auth', authRoutes)
router.use('/user', userRoutes)
router.use('/upload', uploadRoutes)
router.use('/', learningRoutes) // /lessons, /skills
router.use('/', gamificationRoutes) // /challenges, /games, /leaderboard
router.use('/', socialRoutes) // /community, /friends, /groups
router.use('/', systemRoutes) // /notifications, /chatbot

export default router
