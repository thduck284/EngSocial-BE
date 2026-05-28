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

const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : []

function corsOrigin(origin) {
  if (!origin) return CORS_ORIGINS[0] || '*'
  if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) return origin
  return CORS_ORIGINS[0] || '*'
}

// Set CORS headers on every response (so 4xx/5xx and preflight always have them)
app.use((req, res, next) => {
  const origin = corsOrigin(req.headers.origin)
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept-Language')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(cors({
  origin: (o, cb) => cb(null, corsOrigin(o)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}))

// Proxy AI matchmaking → Flask (chat_app_kaggle), cùng máy: ngrok http 5000 (Node) + Flask CHAT_APP_PORT=5010
const AI_MATCHMAKING_INTERNAL_URL = process.env.AI_MATCHMAKING_INTERNAL_URL?.trim()

// Routes that do not require DB (so we can return 503 for others when MONGODB_URI is missing)
const NO_DB_PATHS = ['/api/health', '/api/health/db', '/health', '/health/db']
if (AI_MATCHMAKING_INTERNAL_URL) {
  NO_DB_PATHS.push('/api/matchmake')
}
const isNoDbPath = (path) => path === '/api' || path === '' || path === '/' || NO_DB_PATHS.some((p) => path === p || path.startsWith(p + '?'))

app.use(async (req, res, next) => {
  try {
    const matchmakeProxyBypass =
      AI_MATCHMAKING_INTERNAL_URL && req.path === '/api/matchmake' && req.method === 'POST'
    if (
      !process.env.MONGODB_URI &&
      !(req.method === 'GET' && isNoDbPath(req.path)) &&
      !matchmakeProxyBypass
    ) {
      return res.status(503).json({
        success: false,
        message: 'Database not configured. Set MONGODB_URI in Vercel Environment Variables.',
      })
    }
    await ensureConnected()
    next()
  } catch (err) {
    next(err)
  }
})
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

// AI matchmaking: forward tới Flask (đăng ký trước router /api để không bị notFound)
if (AI_MATCHMAKING_INTERNAL_URL) {
  app.post('/api/matchmake', async (req, res) => {
    const target = AI_MATCHMAKING_INTERNAL_URL
    try {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
      if (/ngrok/i.test(target)) {
        headers['ngrok-skip-browser-warning'] = '69420'
        headers['User-Agent'] =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
      const r = await fetch(target, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body ?? {}),
      })
      const buf = Buffer.from(await r.arrayBuffer())
      const ct = r.headers.get('content-type')
      if (ct) res.setHeader('Content-Type', ct.split(';')[0].trim())
      res.status(r.status).send(buf)
    } catch (err) {
      res.status(502).json({
        success: false,
        message: err?.message || 'AI_MATCHMAKING_PROXY_FAILED',
      })
    }
  })
}

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
      vocabulary: '/api/vocabulary',
      wordScramble: '/api/word-scramble',
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
