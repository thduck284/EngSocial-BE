import 'dotenv/config'
import app from './app.js'
import connectDB from './config/db.js'

const PORT = parseInt(process.env.PORT || '5000', 10)
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
  } else {
    console.warn('MONGODB_URI not set - running without database')
  }

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
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
