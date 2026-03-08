import { Router } from 'express'
import * as friendController from '../../controllers/friend.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', auth, friendController.getFriends)
router.get('/requests/pending', auth, friendController.getPendingRequests)
router.get('/requests/sent', auth, friendController.getSentRequests)
router.post('/request/:userId', auth, friendController.sendRequest)
router.patch('/request/:id/accept', auth, friendController.acceptRequest)
router.delete('/request/:id', auth, friendController.rejectRequest)
router.delete('/:userId', auth, friendController.removeFriend)

export default router
