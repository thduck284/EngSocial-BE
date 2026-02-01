import mongoose from 'mongoose'

const userAchievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  achievementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
  },
  unlockedAt: { type: Date, default: Date.now },
  progress: { type: Number, default: 0 },
  displayed: { type: Boolean, default: false },
})

userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true })
userAchievementSchema.index({ userId: 1, unlockedAt: -1 })

export default mongoose.model('UserAchievement', userAchievementSchema)
