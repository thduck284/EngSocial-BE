import { Router } from 'express'
import * as lessonController from '../../controllers/lesson.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/dashboard', lessonController.getDashboard)
router.get('/my-progress', auth, lessonController.getMyProgress)
router.get('/reading/:id/content', lessonController.getReadingContent)
router.get('/listening/:id/content', lessonController.getListeningContent)
router.get('/writing/:id/content', lessonController.getWritingContent)
router.get('/:id/progress', auth, lessonController.getLessonProgress)
router.post('/:id/notes', auth, lessonController.addLessonNote)
router.post('/:id/submit', auth, lessonController.submitLessonAnswers)
router.post('/:id/submit-writing', auth, lessonController.submitWritingLesson)
router.post('/:id/complete', auth, lessonController.completeLesson)
router.get('/:id', auth, requireModeratorOrAdmin, lessonController.getLessonById)
router.get('/', lessonController.getLessons)

router.post('/', auth, requireModeratorOrAdmin, lessonController.createLesson)
router.put('/:id', auth, requireModeratorOrAdmin, lessonController.updateLesson)
router.delete('/:id', auth, requireModeratorOrAdmin, lessonController.deleteLesson)

export default router
