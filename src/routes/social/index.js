import { Router } from 'express'
import communityRoutes from './community.routes.js'
import friendRoutes from './friend.routes.js'
import groupRoutes from './group.routes.js'

const router = Router()

router.use('/community', communityRoutes)
router.use('/friends', friendRoutes)
router.use('/groups', groupRoutes)

export default router
