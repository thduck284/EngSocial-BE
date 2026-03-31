import { Router } from 'express'
import { auth, requireModeratorOrAdmin } from '../middlewares/index.js'
import { uploadLessonAsset, uploadPostMedia } from '../middlewares/upload.middleware.js'
import * as uploadController from '../controllers/upload.controller.js'

const router = Router()

router.post('/asset', auth, requireModeratorOrAdmin, uploadLessonAsset, uploadController.uploadAsset)
router.post('/post-media', auth, uploadPostMedia, uploadController.uploadPostMedia)

export default router
