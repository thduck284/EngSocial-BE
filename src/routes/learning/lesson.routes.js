import { Router } from 'express'
import * as lessonController from '../../controllers/lesson.controller.js'
import { auth, optionalAuth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createLessonSchema, updateLessonSchema, submitAnswersSchema, submitWritingSchema } from '../../validators/lesson.validator.js'

const router = Router()

/**
 * @route   GET /api/lessons
 * @desc    Get all lessons (with filters)
 * @access  Public
 */
router.get('/', lessonController.getLessons)

/**
 * @route   GET /api/lessons/slug/:slug
 * @desc    Get lesson detail by slug
 * @access  Public
 */
router.get('/slug/:slug', lessonController.getLessonBySlug)

/**
 * @route   GET /api/lessons/:id
 * @desc    Get lesson detail by ID
 * @access  Public
 */
router.get('/:id', lessonController.getLessonById)

/**
 * @route   POST /api/lessons
 * @desc    Create new lesson (teacher/admin)
 * @access  Private
 */
router.post('/', auth, validate(createLessonSchema), lessonController.createLesson)

/**
 * @route   PATCH /api/lessons/:id
 * @desc    Update lesson (teacher/admin)
 * @access  Private
 */
router.patch('/:id', auth, validate(updateLessonSchema), lessonController.updateLesson)

/**
 * @route   DELETE /api/lessons/:id
 * @desc    Delete lesson (teacher/admin)
 * @access  Private
 */
router.delete('/:id', auth, lessonController.deleteLesson)

/**
 * @route   POST /api/lessons/:id/start
 * @desc    Start or resume a lesson
 * @access  Private
 */
router.post('/:id/start', auth, lessonController.startLesson)

/**
 * @route   POST /api/lessons/:id/submit
 * @desc    Submit quiz answers
 * @access  Private
 */
router.post('/:id/submit', auth, validate(submitAnswersSchema), lessonController.submitAnswers)

/**
 * @route   POST /api/lessons/:id/submit-writing
 * @desc    Submit writing
 * @access  Private
 */
router.post('/:id/submit-writing', auth, validate(submitWritingSchema), lessonController.submitWriting)

/**
 * @route   GET /api/lessons/user/progress
 * @desc    Get user's lesson progress
 * @access  Private
 */
router.get('/user/progress', auth, lessonController.getUserProgress)

/**
 * @route   GET /api/lessons/user/skill-stats
 * @desc    Get user's skill statistics
 * @access  Private
 */
router.get('/user/skill-stats', auth, lessonController.getUserSkillStats)

export default router
