import { Router } from 'express'
import * as challengeController from '../../controllers/challenge.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', challengeController.getChallenges)
router.get('/me', auth, challengeController.getUserChallenges)
router.get('/:id', challengeController.getChallengeById)
router.post('/', auth, challengeController.createChallenge)
router.post('/:id/join', auth, challengeController.joinChallenge)
router.patch('/:id/progress', auth, challengeController.updateProgress)
router.get('/:id/leaderboard', challengeController.getChallengeLeaderboard)

export default router
