import { Router } from 'express'
import * as challengeController from '../../controllers/challenge.controller.js'
import { auth, requireAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/', challengeController.getChallenges)
router.get('/me', auth, challengeController.getUserChallenges)
router.get('/:id', challengeController.getChallengeById)
router.post('/', auth, challengeController.createChallenge)
router.put('/:id', auth, requireAdmin, challengeController.updateChallenge)
router.delete('/:id', auth, requireAdmin, challengeController.deleteChallenge)
router.post('/:id/join', auth, challengeController.joinChallenge)
router.patch('/:id/progress', auth, challengeController.updateProgress)
router.get('/:id/leaderboard', challengeController.getChallengeLeaderboard)

export default router
