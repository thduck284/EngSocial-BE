import mongoose from 'mongoose'

const refreshTokenSchema = new mongoose.Schema({
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
    index: { expireAfterSeconds: 0 }, // TTL index
  },
}, {
  timestamps: true,
  bufferCommands: true,
})

refreshTokenSchema.index({ userId: 1 })

export default mongoose.model('RefreshToken', refreshTokenSchema)
