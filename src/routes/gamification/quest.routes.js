import { Router } from 'express'
import * as questController from '../../controllers/quest.controller.js'
import { auth, requireAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/friends', questController.getFriends)
router.get('/notifications', questController.getNotifications)
router.get('/chatbot', questController.getChatbot)
router.get('/', questController.getQuests)
router.get('/:id', auth, requireAdmin, questController.getQuestById)

router.post('/', auth, requireAdmin, questController.createQuest)
router.put('/:id', auth, requireAdmin, questController.updateQuest)
router.delete('/:id', auth, requireAdmin, questController.deleteQuest)

export default router
