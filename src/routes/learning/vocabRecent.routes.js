import { Router } from 'express'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as vocabRecentController from '../../controllers/vocabRecent.controller.js'
import { vocabRecentRecordSchema } from '../../validators/vocabRecent.validator.js'

const router = Router()

router.get('/recent', auth, vocabRecentController.getMyVocabRecent)
router.post('/recent', auth, validate(vocabRecentRecordSchema), vocabRecentController.postMyVocabRecent)

export default router
