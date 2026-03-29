import { Router } from 'express'
import * as skillController from '../../controllers/skill.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

/**
 * @route   GET /api/skills
 * @desc    Get all skills
 * @access  Public
 */
router.get('/', skillController.getSkills)

/**
 * @route   GET /api/skills/:key
 * @desc    Get skill by key
 * @access  Public
 */
router.get('/:key', skillController.getSkillByKey)

/**
 * @route   POST /api/skills
 * @desc    Create skill (admin)
 * @access  Private
 */
router.post('/', auth, requireModeratorOrAdmin, skillController.createSkill)

export default router
