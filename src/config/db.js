import mongoose from 'mongoose'

mongoose.set('bufferCommands', false)

let connectPromise = null

const connectDB = async () => {
  if (!process.env.MONGODB_URI) return
  if (connectPromise) return connectPromise
  connectPromise = mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || 'engsocial',
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 10,
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
  await connectDB()
}
