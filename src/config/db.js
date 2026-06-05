import mongoose from 'mongoose'

let connectPromise = null

const MONGO_RETRY_ATTEMPTS = 3
const MONGO_RETRY_DELAY_MS = 2500

function mongoConnectOptions() {
  const isDev = process.env.NODE_ENV !== 'production'
  return {
    dbName: process.env.DB_NAME || 'engsocial',
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
    // Một số mạng Windows/ISP lỗi qua IPv6 → ưu tiên IPv4
    family: 4,
    ...(isDev && { tlsAllowInvalidCertificates: true }),
  }
}

function isTransientMongoError(err) {
  const msg = `${err?.message || ''} ${err?.cause?.message || ''}`
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|ETIMEOUT|socket hang up|Server selection/i.test(msg)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const connectDB = async () => {
  if (!process.env.MONGODB_URI) return
  if (connectPromise) return connectPromise

  let lastError = null
  for (let attempt = 1; attempt <= MONGO_RETRY_ATTEMPTS; attempt += 1) {
    try {
      connectPromise = mongoose.connect(process.env.MONGODB_URI, mongoConnectOptions())
      const conn = await connectPromise
      console.log(`MongoDB connected: ${conn.connection.host}`)
      return connectPromise
    } catch (error) {
      lastError = error
      connectPromise = null
      try {
        await mongoose.disconnect()
      } catch {
        /* ignore */
      }
      if (attempt < MONGO_RETRY_ATTEMPTS && isTransientMongoError(error)) {
        console.warn(
          `MongoDB connect attempt ${attempt}/${MONGO_RETRY_ATTEMPTS} failed (${error.message}), retrying…`,
        )
        await sleep(MONGO_RETRY_DELAY_MS)
        continue
      }
      break
    }
  }

  console.error('MongoDB connection error:', lastError?.message || lastError)
  console.error(
    'Gợi ý: kiểm tra internet/VPN, Atlas cluster đang chạy, IP whitelist (0.0.0.0/0), thử tắt VPN hoặc chạy lại npm run dev.',
  )
  process.exit(1)
}

export default connectDB

export async function ensureConnected() {
  if (!process.env.MONGODB_URI) return
  await connectDB()
}
