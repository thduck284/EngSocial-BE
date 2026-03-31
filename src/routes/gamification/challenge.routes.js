import { Router } from 'express'
import * as challengeController from '../../controllers/challenge.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/', challengeController.getChallenges)
router.get('/me', auth, challengeController.getUserChallenges)
router.get('/:id', challengeController.getChallengeById)
router.post('/', auth, requireModeratorOrAdmin, challengeController.createChallenge)
router.put('/:id', auth, requireModeratorOrAdmin, challengeController.updateChallenge)
router.delete('/:id', auth, requireModeratorOrAdmin, challengeController.deleteChallenge)
router.post('/:id/join', auth, challengeController.joinChallenge)
router.patch('/:id/progress', auth, challengeController.updateProgress)
router.get('/:id/leaderboard', challengeController.getChallengeLeaderboard)

export default router
