import { Router } from 'express'
import * as groupController from '../../controllers/group.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', groupController.getGroups)
router.get('/me', auth, groupController.getUserGroups)
router.get('/:id', groupController.getGroupById)
router.post('/', auth, groupController.createGroup)
router.post('/:id/join', auth, groupController.joinGroup)
router.post('/:id/leave', auth, groupController.leaveGroup)
router.post('/:id/members', auth, groupController.addMembers)
router.get('/:id/members', groupController.getMembers)

export default router
