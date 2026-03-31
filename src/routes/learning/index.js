import { Router } from 'express'
import lessonRoutes from './lesson.routes.js'
import practiceRoutes from './practice.routes.js'
import skillRoutes from './skill.routes.js'
import vocabRecentRoutes from './vocabRecent.routes.js'
import wordScrambleRoutes from './wordScramble.routes.js'

const router = Router()

router.use('/lessons', lessonRoutes)
router.use('/practices', practiceRoutes)
router.use('/skills', skillRoutes)
router.use('/vocabulary', vocabRecentRoutes)

router.use('/word-scramble', wordScrambleRoutes)

export default router
