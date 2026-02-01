import dotenv from 'dotenv'
import app from './app.js'
import connectDB from './config/db.js'

dotenv.config()

const PORT = parseInt(process.env.PORT || '5000', 10)

async function start() {
  if (process.env.MONGODB_URI) {
    await connectDB()
  } else {
    console.warn('MONGODB_URI not set - running without database')
  }

  const server = app.listen(PORT, () => {
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
