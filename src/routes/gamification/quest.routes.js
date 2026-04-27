import { Router } from 'express'
import * as questController from '../../controllers/quest.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/my/period', auth, questController.getMyPeriodicQuests)
router.get('/my/progress', auth, questController.getMyQuestProgress)
router.get('/pool', auth, requireModeratorOrAdmin, questController.getPeriodicQuestPool)
router.get('/pool/:poolId', auth, requireModeratorOrAdmin, questController.getPeriodicQuestPoolById)
router.post('/pool', auth, requireModeratorOrAdmin, questController.createPeriodicQuestPoolEntry)
router.put('/pool/:poolId', auth, requireModeratorOrAdmin, questController.updatePeriodicQuestPoolEntry)
router.delete('/pool/:poolId', auth, requireModeratorOrAdmin, questController.deletePeriodicQuestPoolEntry)
router.get('/', questController.getQuests)
router.get('/:id', auth, requireModeratorOrAdmin, questController.getQuestById)

router.post('/', auth, requireModeratorOrAdmin, questController.createQuest)
router.put('/:id', auth, requireModeratorOrAdmin, questController.updateQuest)
router.delete('/:id', auth, requireModeratorOrAdmin, questController.deleteQuest)

export default router
