import { Router } from 'express'
import * as questController from '../../controllers/quest.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/friends', questController.getFriends)
router.get('/notifications', questController.getNotifications)
router.get('/chatbot', questController.getChatbot)
router.get('/', questController.getQuests)
router.get('/:id', auth, requireModeratorOrAdmin, questController.getQuestById)

router.post('/', auth, requireModeratorOrAdmin, questController.createQuest)
router.put('/:id', auth, requireModeratorOrAdmin, questController.updateQuest)
router.delete('/:id', auth, requireModeratorOrAdmin, questController.deleteQuest)

export default router
