import mongoose from 'mongoose'

const userSkillStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing'],
    required: true,
  },
  totalTimeSpent: { type: Number, default: 0 }, // minutes
  weeklyTimeSpent: { type: Number, default: 0 },
  dailyTimeSpent: { type: Number, default: 0 },
  lessonsCompleted: { type: Number, default: 0 },
  lessonsInProgress: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  highestScore: { type: Number, default: 0 },
  totalXpEarned: { type: Number, default: 0 },
  skillLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A1',
  },
  lastActivityAt: Date,
}, { timestamps: true })

userSkillStatsSchema.index({ userId: 1, skill: 1 }, { unique: true })
userSkillStatsSchema.index({ skill: 1, totalXpEarned: -1 })

export default mongoose.model('UserSkillStats', userSkillStatsSchema)
