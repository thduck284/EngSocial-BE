import { Router } from 'express'
import * as practiceController from '../../controllers/practice.controller.js'

const router = Router()

router.get('/games', practiceController.getGames)
router.get('/fallback', practiceController.getFallback)
router.get('/', practiceController.getPractices)

export default router
