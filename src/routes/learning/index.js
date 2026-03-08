import { Router } from 'express'
import lessonRoutes from './lesson.routes.js'
import skillRoutes from './skill.routes.js'
//import dailyGoalRoutes from './dailygoal.routes.js'

const router = Router()

router.use('/lessons', lessonRoutes)
router.use('/practices', practiceRoutes)
router.use('/skills', skillRoutes)
//router.use('/daily-goals', dailyGoalRoutes)

export default router
