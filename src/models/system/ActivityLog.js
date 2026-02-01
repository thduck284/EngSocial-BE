import mongoose from 'mongoose'

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: [
      'login', 'logout', 'lesson_start', 'lesson_complete',
      'game_play', 'challenge_join', 'achievement_unlock',
      'post_create', 'comment_create', 'friend_add'
    ],
    required: true,
  },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: mongoose.Schema.Types.Mixed,
  xpChange: Number,
  ip: String,
  userAgent: String,
}, { timestamps: true })

activityLogSchema.index({ userId: 1, createdAt: -1 })
activityLogSchema.index({ action: 1, createdAt: -1 })
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL

export default mongoose.model('ActivityLog', activityLogSchema)
