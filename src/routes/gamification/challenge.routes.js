import { Router } from 'express'

const router = Router()

// TODO: Implement challenge routes
router.get('/', (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' })
})

export default router
