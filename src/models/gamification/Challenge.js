import mongoose from 'mongoose'

const challengeSchema = new mongoose.Schema({
  // Keep legacy title/description and add explicit locale fields.
  title: { type: String, required: true },
  titleVi: String,
  titleEn: String,
  description: String,
  descriptionVi: String,
  descriptionEn: String,
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'special'],
    required: true,
  },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'all'],
  },
  requirement: {
    type: {
      type: String,
      /** `lessons`: mục tiêu đếm gồm cả hoàn thành lesson và practice (một bộ đếm; BE cộng dồn khi có hook). */
      enum: ['lessons', 'time', 'score', 'streak'],
    },
    target: Number,
  },
  xpReward: { type: Number, default: 0 },
  badge: String,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  participantCount: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  icon: String,
  color: String,
  status: {
    type: String,
    enum: ['upcoming', 'active', 'ended'],
    default: 'upcoming',
  },
}, { timestamps: true })

challengeSchema.index({ status: 1, endDate: 1 })
challengeSchema.index({ type: 1, status: 1 })
challengeSchema.index({ startDate: 1, endDate: 1 })

export default mongoose.model('Challenge', challengeSchema)
