import { Router } from 'express'
import * as conversationController from '../../controllers/conversation.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { uploadMessageAttachment } from '../../middlewares/upload.middleware.js'
import { sendError } from '../../dto/index.js'

const router = Router()

router.get('/', auth, conversationController.getMyConversations)
router.get('/unread-total', auth, conversationController.getUnreadTotal)
router.get('/with', auth, conversationController.getOrCreateWithUser) // /conversations/with?with=userId
router.get('/attachment-download', auth, conversationController.downloadMessageAttachment)
router.get('/:id/messages', auth, conversationController.getMessages)
router.put('/:id/messages/:messageId/reaction', auth, conversationController.reactToMessage)
router.patch('/:id/messages/:messageId', auth, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return uploadMessageAttachment(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'File too large. Maximum 50MB per file.' : 'File quá lớn. Tối đa 50MB mỗi file.' }, req)
        }
        return next(err)
      }
      next()
    })
  }
  next()
}, conversationController.updateMessage)
router.delete('/:id/messages/:messageId', auth, conversationController.deleteMessage)
router.post('/:id/messages/delete-all', auth, conversationController.deleteAllMessagesForMe)
router.post('/:id/messages', auth, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return uploadMessageAttachment(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'File too large. Maximum 50MB per file.' : 'File quá lớn. Tối đa 50MB mỗi file.' }, req)
        }
        return next(err)
      }
      next()
    })
  }
  next()
}, conversationController.sendMessage)
router.patch('/:id/read', auth, conversationController.markAsRead)
router.patch('/:id/settings', auth, conversationController.updateConversationSettings)

export default router
