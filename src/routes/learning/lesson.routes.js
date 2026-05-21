import { Router } from 'express'
import * as lessonController from '../../controllers/lesson.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

router.get('/dashboard', lessonController.getDashboard)
router.get('/my-progress', auth, lessonController.getMyProgress)
router.get('/user-progress/:targetUserId', auth, requireModeratorOrAdmin, lessonController.getUserProgressByMod)
router.get('/history', auth, lessonController.getMyProgress)
router.get('/reading/:id/content', lessonController.getReadingContent)
router.get('/listening/:id/content', lessonController.getListeningContent)
router.get('/writing/:id/content', lessonController.getWritingContent)
router.get('/:id/progress', auth, lessonController.getLessonProgress)
router.post('/:id/notes', auth, lessonController.addLessonNote)
router.post('/:id/submit', auth, lessonController.submitLessonAnswers)
router.post('/:id/submit-writing', auth, lessonController.submitWritingLesson)
router.post('/:id/complete', auth, lessonController.completeLesson)
router.get('/:id', auth, lessonController.getLessonById)
router.get('/', lessonController.getLessons)

router.get('/:id/reviews', lessonController.getLessonReviews)
router.post('/:id/reviews', auth, lessonController.addLessonReview)

router.post('/', auth, requireModeratorOrAdmin, lessonController.createLesson)
router.get('/:id/all-results', auth, requireModeratorOrAdmin, lessonController.getAllLessonResults)
router.post('/:id/ai-grade/:userId', auth, lessonController.aiGradeWriting)
router.post('/:id/grade/:userId', auth, requireModeratorOrAdmin, lessonController.gradeUserWriting)
router.put('/:id', auth, requireModeratorOrAdmin, lessonController.updateLesson)
router.delete('/:id', auth, requireModeratorOrAdmin, lessonController.deleteLesson)

export default router
