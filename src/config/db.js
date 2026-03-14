import mongoose from 'mongoose'

let connectPromise = null

const connectDB = async () => {
  if (!process.env.MONGODB_URI) return
  if (connectPromise) return connectPromise
  try {
    connectPromise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'engsocial',
    })
    const conn = await connectPromise
    console.log(`MongoDB connected: ${conn.connection.host}`)
    return connectPromise
  } catch (error) {
    connectPromise = null
    console.error('MongoDB connection error:', error.message)
    process.exit(1)
  }
}

export default connectDB

export async function ensureConnected() {
  if (!process.env.MONGODB_URI) return
  await connectDB()
}
