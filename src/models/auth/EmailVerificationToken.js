import mongoose from 'mongoose'

const emailVerificationTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
}, {
  timestamps: true,
  bufferCommands: true,
})

emailVerificationTokenSchema.index({ userId: 1 })

export default mongoose.model('EmailVerificationToken', emailVerificationTokenSchema)
