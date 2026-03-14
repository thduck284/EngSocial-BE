import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middlewares/error.middleware.js'
import { locale } from './middlewares/locale.middleware.js'
import { ensureConnected } from './config/db.js'

const app = express()

app.use(async (req, res, next) => {
  try {
    await ensureConnected()
    next()
  } catch (err) {
    next(err)
  }
})

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : ['https://eng-social-fe.vercel.app', 'http://localhost:3000'],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Language from frontend (Accept-Language header). req.language = 'vi' | 'en', default 'vi'
app.use(locale)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
})

// API base info
app.get('/api', (req, res) => {
  res.json({
    name: 'EngSocial API',
    version: '0.1.0',
    docs: '/api/health',
    endpoints: {
      auth: '/api/auth',
      raw: '/api/raw',
      user: '/api/user',
      lessons: '/api/lessons',
      practices: '/api/practices',
      quests: '/api/quests',
      skills: '/api/skills',
      challenges: '/api/challenges',
      games: '/api/games',
      community: '/api/community',
      notifications: '/api/notifications',
      chatbot: '/api/chatbot',
      leaderboard: '/api/leaderboard',
      friends: '/api/friends',
      groups: '/api/groups',
    },
  })
})

// Mount all routes
app.use('/api', routes)

// Error handling
app.use(notFound)
app.use(errorHandler)

export default app
