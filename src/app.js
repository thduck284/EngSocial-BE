import './config/db.js'
import mongoose from 'mongoose'
// Force bufferCommands true so serverless cold start does not throw "before initial connection"
mongoose.set('bufferCommands', true)
import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middlewares/error.middleware.js'
import { locale } from './middlewares/locale.middleware.js'
import { ensureConnected } from './config/db.js'

const app = express()

const DEBUG_DB = process.env.DEBUG_DB === '1' || process.env.NODE_ENV !== 'production'

// Routes that do not require DB (so we can return 503 for others when MONGODB_URI is missing)
const NO_DB_PATHS = ['/api/health', '/api/health/db']
const isNoDbPath = (path) => path === '/api' || path === '' || path === '/' || NO_DB_PATHS.some((p) => path === p || path.startsWith(p + '?'))

app.use(async (req, res, next) => {
  try {
    if (!process.env.MONGODB_URI && !(req.method === 'GET' && isNoDbPath(req.path))) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured. Set MONGODB_URI in Vercel Environment Variables.',
      })
    }
    if (DEBUG_DB) console.log('[API] before ensureConnected', req.method, req.path)
    await ensureConnected()
    if (DEBUG_DB) console.log('[API] after ensureConnected, calling next()')
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

// Health check (no DB required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
})

// DB connection check (for debugging: verify MONGODB_URI and Atlas access)
app.get('/api/health/db', async (req, res) => {
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({ success: false, message: 'MONGODB_URI not set', db: 'not_configured' })
  }
  try {
    const { default: connectDB } = await import('./config/db.js')
    await connectDB()
    const state = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
    const readyState = mongoose.connection.readyState
    if (readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'DB not connected',
        db: state[readyState] || readyState,
      })
    }
    await mongoose.connection.db.admin().ping()
    res.json({
      success: true,
      message: 'DB connected',
      db: 'connected',
      host: mongoose.connection.host,
    })
  } catch (err) {
    res.status(503).json({
      success: false,
      message: err.message || 'DB connection failed',
      db: 'error',
    })
  }
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

// Mount all routes: /api/* and /* (Vercel may forward without /api prefix)
app.use('/api', routes)
app.use(routes)

// Error handling
app.use(notFound)
app.use(errorHandler)

export default app
