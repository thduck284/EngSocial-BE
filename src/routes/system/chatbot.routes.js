import { Router } from 'express'

const router = Router()

// TODO: Implement chatbot routes
router.post('/chat', (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' })
})

export default router
