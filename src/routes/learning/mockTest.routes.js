import express from 'express'
import * as mockTestController from '../../controllers/mockTest.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = express.Router()

// All routes are protected
router.use(auth)

router.post('/record', mockTestController.recordSession)
router.get('/my-history', mockTestController.getMyHistory)
router.get('/all-results', requireModeratorOrAdmin, mockTestController.getAllMockTestSessions)
router.get('/session/:id', mockTestController.getSessionDetail)
router.post('/:id/sync-scores', requireModeratorOrAdmin, mockTestController.syncMockTestQuizScores)
router.get('/user-results/:userId', requireModeratorOrAdmin, mockTestController.getUserHistoryByMod)

export default router
