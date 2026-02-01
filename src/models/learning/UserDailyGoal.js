import mongoose from 'mongoose'

const goalSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: ['lessons', 'time', 'xp', 'streak', 'custom'],
  },
  description: String,
  target: Number,
  current: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  completedAt: Date,
}, { _id: false })

const userDailyGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: { type: Date, required: true },
  goals: [goalSchema],
  allCompleted: { type: Boolean, default: false },
  xpBonus: { type: Number, default: 0 },
}, { timestamps: true })

userDailyGoalSchema.index({ userId: 1, date: -1 })
userDailyGoalSchema.index({ date: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL

export default mongoose.model('UserDailyGoal', userDailyGoalSchema)
