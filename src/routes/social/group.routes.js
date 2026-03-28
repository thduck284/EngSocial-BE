import { Router } from 'express'
import * as groupController from '../../controllers/group.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/', groupController.getGroups)
router.get('/me', auth, groupController.getUserGroups)
router.get('/:id/my-membership', auth, groupController.getMyMembership)
router.get('/:id', groupController.getGroupById)
router.post('/', auth, groupController.createGroup)
router.patch('/:id', auth, groupController.updateGroup)
router.post('/:id/join', auth, groupController.joinGroup)
router.post('/:id/leave', auth, groupController.leaveGroup)
router.get('/:id/join-requests', auth, groupController.getJoinRequests)
router.post('/:id/join-requests/:userId/approve', auth, groupController.approveJoinRequest)
router.post('/:id/join-requests/:userId/reject', auth, groupController.rejectJoinRequest)
router.post('/:id/invite/accept', auth, groupController.acceptGroupInvite)
router.post('/:id/invite/decline', auth, groupController.declineGroupInvite)
router.delete('/:id/members/:userId', auth, groupController.removeMember)
router.post('/:id/members', auth, groupController.addMembers)
router.get('/:id/members', groupController.getMembers)

export default router
