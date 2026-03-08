import { Router } from 'express'
import * as chatbotController from '../../controllers/chatbot.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { sendChatMessageSchema } from '../../validators/chatbot.validator.js'

const router = Router()

router.get('/conversations', auth, chatbotController.getConversations)
router.get('/conversations/:conversationId/messages', auth, chatbotController.getMessages)
router.post('/chat', auth, validate(sendChatMessageSchema), chatbotController.sendMessage)
router.delete('/conversations/:conversationId', auth, chatbotController.deleteConversation)

export default router
