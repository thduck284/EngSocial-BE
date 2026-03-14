import mongoose from 'mongoose'

let connectPromise = null

const connectDB = async () => {
  if (!process.env.MONGODB_URI) return
  if (mongoose.connection.readyState === 1) return
  if (connectPromise) return connectPromise
  connectPromise = mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || 'engsocial',
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 10,
    bufferCommands: false,
  })
  try {
    const conn = await connectPromise
    console.log(`MongoDB connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    connectPromise = null
    if (process.env.VERCEL) throw error
    process.exit(1)
  }
  return connectPromise
}

export default connectDB

export async function ensureConnected() {
  if (!process.env.MONGODB_URI) return
  if (mongoose.connection.readyState === 1) return
  await connectDB()
}
