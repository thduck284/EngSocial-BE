import { Router } from 'express'
import * as leaderboardController from '../../controllers/leaderboard.controller.js'
import { auth, optionalAuth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', optionalAuth, leaderboardController.getLeaderboard)
router.post('/generate', auth, leaderboardController.generateLeaderboard)

export default router
