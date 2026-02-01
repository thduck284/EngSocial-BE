import { Router } from 'express'
import lessonRoutes from './lesson.routes.js'
import skillRoutes from './skill.routes.js'

const router = Router()

router.use('/lessons', lessonRoutes)
router.use('/skills', skillRoutes)

export default router
