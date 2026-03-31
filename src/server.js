import './config/loadEnv.js'
import './config/db.js'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import app from './app.js'
import connectDB from './config/db.js'
import { socketOptions, setupSocket } from './config/socket.js'

const PORT = parseInt(process.env.PORT, 10)
let server = null

function shutdown(signal) {
  return () => {
    if (server) {
      server.close(() => {
        console.log(`\n${signal}: server closed, port ${PORT} released`)
        process.exit(0)
      })
      setTimeout(() => process.exit(1), 3000)
    } else {
      process.exit(0)
    }
  }
}

process.on('SIGINT', shutdown('SIGINT'))
process.on('SIGTERM', shutdown('SIGTERM'))

async function start() {
  if (process.env.MONGODB_URI) {
    await connectDB()
    try {
      const { default: Conversation } = await import('./models/social/Conversation.js')
      await Conversation.collection.dropIndex('participants_1_type_1')
      console.log('Dropped old unique index participants_1_type_1 (if existed)')
    } catch (e) {
      if (e.code !== 27 && e.codeName !== 'IndexNotFound') console.warn('Conversation index drop:', e?.message || e)
    }
  } else {
    console.warn('MONGODB_URI not set - running without database')
  }

  if (process.env.MONGODB_URI && (process.env.ELASTICSEARCH_NODE || process.env.ELASTICSEARCH_URL)) {
    try {
      const { initUserSearch } = await import('./config/elasticsearch/userSearch.service.js')
      const { User } = await import('./models/index.js')
      await initUserSearch(async () => {
        const list = await User.find({}).select('name email updatedAt').lean()
        return list.map((u) => ({ id: u._id.toString(), name: u.name, email: u.email, updatedAt: u.updatedAt }))
      })
    } catch (err) {
      console.warn('Elasticsearch init failed:', err?.message)
    }
  }

  server = http.createServer(app)
  const io = new SocketIOServer(server, socketOptions)
  app.set('io', io)
  setupSocket(io)

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
    console.log(`Socket.IO: enabled`)
  })

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env`)
    } else {
      console.error(err)
    }
    process.exit(1)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
