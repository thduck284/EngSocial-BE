import mongoose from 'mongoose'

const DEBUG_DB = process.env.DEBUG_DB === '1' || process.env.NODE_ENV !== 'production'
const log = (...args) => DEBUG_DB && console.log('[DB]', ...args)

mongoose.set('bufferCommands', false)

let connectPromise = null

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    log('connectDB: no MONGODB_URI')
    return
  }
  if (connectPromise) {
    log('connectDB: reusing promise, readyState=', mongoose.connection.readyState)
    return connectPromise
  }
  log('connectDB: starting...')
  connectPromise = mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || 'engsocial',
    serverSelectionTimeoutMS: 20000,
    maxPoolSize: 10,
  })
  try {
    const conn = await connectPromise
    log('connectDB: done, readyState=', conn.connection.readyState)
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
  log('ensureConnected: start')
  if (!process.env.MONGODB_URI) {
    log('ensureConnected: no MONGODB_URI, skip')
    return
  }
  await connectDB()
  log('ensureConnected: done, readyState=', mongoose.connection.readyState)
}
