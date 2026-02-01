import { Router } from 'express'

const router = Router()

// TODO: Implement user routes
router.get('/profile/:id', (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' })
})

export default router
