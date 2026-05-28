import { Router } from 'express'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createContentReportSchema } from '../../validators/report.validator.js'
import * as reportController from '../../controllers/report.controller.js'

const router = Router()

router.post('/', auth, validate(createContentReportSchema), reportController.createContentReport)

export default router
