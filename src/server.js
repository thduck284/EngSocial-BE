import dotenv from 'dotenv'
import app from './app.js'
import connectDB from './config/db.js'

dotenv.config()

const PORT = process.env.PORT || 3000

// Connect to MongoDB if URI is provided
if (process.env.MONGODB_URI) {
  connectDB().then(() => {
    startServer()
  })
} else {
  console.warn('MONGODB_URI not set - running without database')
  startServer()
}

function startServer() {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
  })
}
