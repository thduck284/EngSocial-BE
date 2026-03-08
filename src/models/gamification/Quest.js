import mongoose from 'mongoose'

/**
 * Quest - Nhiệm vụ hàng ngày/tuần cho người học
 */
const questSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'one_time'],
    default: 'daily',
  },
  targetType: { type: String, enum: ['lesson', 'practice_skill', 'both'], default: 'lesson' },
  targetValue: { type: Number, required: true },
  xpReward: { type: Number, default: 50 },
  icon: { type: String, default: 'flag' },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'all'],
    default: 'all',
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
  order: { type: Number, default: 0 },
}, { timestamps: true })

questSchema.index({ status: 1, type: 1 })
questSchema.index({ order: 1 })

export default mongoose.model('Quest', questSchema)
