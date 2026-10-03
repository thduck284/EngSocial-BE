import { Router } from 'express'
import { auth, requireModeratorOrAdmin, validate } from '../../middlewares/index.js'
import * as wordScrambleController from '../../controllers/wordScramble.controller.js'
import {
  createWordScrambleSchema,
  importWordScrambleTsvSchema,
  updateWordScrambleSchema,
} from '../../validators/wordScramble.validator.js'

const router = Router()

/** Game: lấy ngẫu nhiên một từ (không cần đăng nhập) */
router.get('/next', wordScrambleController.getNextWord)

/** CRUD: moderator / admin */
router.get('/words', auth, requireModeratorOrAdmin, wordScrambleController.listWords)
router.post(
  '/words/import-tsv',
  auth,
  requireModeratorOrAdmin,
  validate(importWordScrambleTsvSchema),
  wordScrambleController.importTsv
)
router.post('/words', auth, requireModeratorOrAdmin, validate(createWordScrambleSchema), wordScrambleController.createWord)
router.delete('/words/all', auth, requireModeratorOrAdmin, wordScrambleController.deleteAllWords)
router.patch('/words/:id', auth, requireModeratorOrAdmin, validate(updateWordScrambleSchema), wordScrambleController.updateWord)
router.delete('/words/:id', auth, requireModeratorOrAdmin, wordScrambleController.deleteWord)

/** Multiplayer Results */
router.get('/results/:roomCode', auth, wordScrambleController.getGameResults)

/** Solo progress */
router.get('/progress', auth, wordScrambleController.getSoloProgress)
router.post('/progress', auth, wordScrambleController.updateSoloProgress)

export default router
