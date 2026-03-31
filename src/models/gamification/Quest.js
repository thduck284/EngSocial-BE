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
  condition: {
    target: { type: Number, required: true, min: 1, default: 1 },
    filters: {
      skill: { type: String, enum: ['reading', 'listening', 'writing', 'all'], default: 'all' },
      category: { type: String, enum: ['lesson', 'practice', 'all'], default: 'all' },
      minProgress: { type: Number, min: 0, max: 100, default: 100 },
      minScorePercent: { type: Number, min: 0, max: 100, default: 0 },
    },
  },
  xpReward: { type: Number, default: 50 },
  icon: { type: String, default: 'flag' },
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
