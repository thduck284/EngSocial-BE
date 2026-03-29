import { Router } from 'express'
import * as gameController from '../../controllers/game.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', gameController.getGames)
router.get('/history', auth, gameController.getUserHistory)
router.get('/:id', gameController.getGameById)
router.post('/', auth, gameController.createGame)
router.post('/:id/start', auth, gameController.startSession)
router.post('/sessions/:sessionId/submit', auth, gameController.submitSession)
router.post('/matchmaking/test', auth, gameController.testMatchmaking)

export default router
