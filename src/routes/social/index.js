import { Router } from 'express'
import communityRoutes from './community.routes.js'
import conversationRoutes from './conversation.routes.js'
import friendRoutes from './friend.routes.js'
import groupRoutes from './group.routes.js'
import reportRoutes from './report.routes.js'

const router = Router()

router.use('/community', communityRoutes)
router.use('/conversations', conversationRoutes)
router.use('/friends', friendRoutes)
router.use('/groups', groupRoutes)
router.use('/reports', reportRoutes)

export default router
