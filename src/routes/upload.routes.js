import { Router } from 'express'
import { auth, requireAdmin } from '../middlewares/index.js'
import { uploadLessonAsset, uploadPostMedia } from '../middlewares/upload.middleware.js'
import * as uploadController from '../controllers/upload.controller.js'

const router = Router()

router.post('/asset', auth, requireAdmin, uploadLessonAsset, uploadController.uploadAsset)
router.post('/post-media', auth, uploadPostMedia, uploadController.uploadPostMedia)

export default router
