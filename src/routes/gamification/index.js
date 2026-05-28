import { Router } from 'express'
import questRoutes from './quest.routes.js'
import challengeRoutes from './challenge.routes.js'
import gameRoutes from './game.routes.js'
import leaderboardRoutes from './leaderboard.routes.js'
import achievementRoutes from './achievement.routes.js'

const router = Router()

router.use('/quests', questRoutes)
router.use('/challenges', challengeRoutes)
router.use('/games', gameRoutes)
router.use('/leaderboard', leaderboardRoutes)
router.use('/achievements', achievementRoutes)

export default router
