import { Router } from 'express'
import * as achievementController from '../../controllers/achievement.controller.js'
import { auth, requireModeratorOrAdmin } from '../../middlewares/index.js'

const router = Router()

// Management routes (Moderator or Admin)
router.get('/', auth, requireModeratorOrAdmin, achievementController.getAchievements)
router.post('/', auth, requireModeratorOrAdmin, achievementController.createAchievement)
router.put('/:id', auth, requireModeratorOrAdmin, achievementController.updateAchievement)
router.delete('/:id', auth, requireModeratorOrAdmin, achievementController.deleteAchievement)

export default router
