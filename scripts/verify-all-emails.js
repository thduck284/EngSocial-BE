/**
 * Đánh dấu tất cả user đã xác minh email (emailVerified: true).
 *
 * Chạy:
 *   npm run db:verify-all-emails
 *
 * Chỉ cập nhật user chưa verified; xóa token xác minh email còn lại.
 */
import '../src/config/loadEnv.js'
import mongoose from 'mongoose'
import { User, EmailVerificationToken } from '../src/models/auth/index.js'

const mongoConnectOptions = () => ({
  dbName: process.env.DB_NAME || 'engsocial',
  serverSelectionTimeoutMS: 30_000,
  connectTimeoutMS: 30_000,
  family: 4,
  ...(process.env.NODE_ENV !== 'production' && { tlsAllowInvalidCertificates: true }),
})

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Thiếu MONGODB_URI trong .env')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI, mongoConnectOptions())
  console.log(`Đã kết nối MongoDB (${mongoose.connection.host})`)

  const totalUsers = await User.countDocuments()
  const unverifiedBefore = await User.countDocuments({ emailVerified: { $ne: true } })

  const result = await User.updateMany(
    { emailVerified: { $ne: true } },
    { $set: { emailVerified: true } },
  )

  const tokenDelete = await EmailVerificationToken.deleteMany({})

  const verifiedAfter = await User.countDocuments({ emailVerified: true })

  console.log('--- Kết quả ---')
  console.log(`Tổng user:              ${totalUsers}`)
  console.log(`Chưa verified (trước):   ${unverifiedBefore}`)
  console.log(`Đã cập nhật:           ${result.modifiedCount}`)
  console.log(`Verified sau khi chạy: ${verifiedAfter}`)
  console.log(`Token xác minh đã xóa:   ${tokenDelete.deletedCount}`)

  await mongoose.disconnect()
  console.log('Hoàn tất.')
}

main().catch((err) => {
  console.error('Lỗi:', err.message)
  process.exit(1)
})
