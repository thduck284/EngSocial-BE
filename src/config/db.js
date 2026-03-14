import mongoose from 'mongoose'

// Must run before any model/query; required for serverless (cold start).
mongoose.set('bufferCommands', true)
// Default bufferTimeoutMS is 10000; serverless cold start + Atlas can be slow.
mongoose.set('bufferTimeoutMS', 60000)

const DEBUG_DB = process.env.DEBUG_DB === '1' || process.env.NODE_ENV !== 'production'
const log = (...args) => DEBUG_DB && console.log('[DB]', ...args)

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
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 15000,
    maxPoolSize: 10,
    bufferCommands: true,
    bufferTimeoutMS: 60000,
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
  if (mongoose.connection.readyState !== 1) {
    log('ensureConnected: readyState not 1, reconnecting...', mongoose.connection.readyState)
    connectPromise = null
    try {
      await mongoose.connection.close()
    } catch {}
    await connectDB()
  }
  log('ensureConnected: done, readyState=', mongoose.connection.readyState)
}

// Start connection as soon as module loads (serverless cold start)
if (typeof process !== 'undefined' && process.env.MONGODB_URI) {
  connectDB().catch((err) => {
    console.error('[DB] warm-up connect failed', err.message)
    connectPromise = null
  })
}
