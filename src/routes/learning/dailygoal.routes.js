import { Router } from 'express'
import * as dailyGoalController from '../../controllers/dailygoal.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'

const router = Router()

router.get('/today', auth, dailyGoalController.getTodayGoals)
router.patch('/progress', auth, dailyGoalController.updateGoalProgress)
router.get('/history', auth, dailyGoalController.getGoalHistory)

export default router
