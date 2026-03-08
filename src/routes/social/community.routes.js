import { Router } from 'express'
import * as communityController from '../../controllers/community.controller.js'
import { auth } from '../../middlewares/index.js'

const router = Router()

router.get('/posts', communityController.getPosts)
router.post('/posts', auth, communityController.createPost)

export default router
