import { Router } from 'express'
import * as questController from '../../controllers/quest.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/my/period', auth, questController.getMyPeriodicQuests)
router.get('/pool', auth, requireModeratorOrAdmin, questController.getPeriodicQuestPool)
router.get('/pool/:poolId', auth, requireModeratorOrAdmin, questController.getPeriodicQuestPoolById)
router.post('/pool', auth, requireModeratorOrAdmin, questController.createPeriodicQuestPoolEntry)
router.put('/pool/:poolId', auth, requireModeratorOrAdmin, questController.updatePeriodicQuestPoolEntry)
router.delete('/pool/:poolId', auth, requireModeratorOrAdmin, questController.deletePeriodicQuestPoolEntry)

export default router
