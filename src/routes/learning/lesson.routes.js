import { Router } from 'express'
import * as lessonController from '../../controllers/lesson.controller.js'
import { auth, requireAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/dashboard', lessonController.getDashboard)
router.get('/my-progress', auth, lessonController.getMyProgress)
router.get('/reading/:id/content', lessonController.getReadingContent)
router.get('/listening/:id/content', lessonController.getListeningContent)
router.get('/writing/:id/content', lessonController.getWritingContent)
router.get('/:id/progress', auth, lessonController.getLessonProgress)
router.patch('/:id/progress', auth, lessonController.updateLessonProgress)
router.post('/:id/notes', auth, lessonController.addLessonNote)
router.post('/:id/complete', auth, lessonController.completeLesson)
router.get('/:id', auth, requireAdmin, lessonController.getLessonById)
router.get('/', lessonController.getLessons)

router.post('/', auth, requireAdmin, lessonController.createLesson)
router.put('/:id', auth, requireAdmin, lessonController.updateLesson)
router.delete('/:id', auth, requireAdmin, lessonController.deleteLesson)

export default router
