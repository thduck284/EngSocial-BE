import mongoose from 'mongoose'

/** Mẫu trong kho DB — không có title/description; BE chọn ngẫu nhiên khi gán cho user theo kỳ. */
const periodicQuestPoolSchema = new mongoose.Schema({
  periodType: {
    type: String,
    enum: ['daily', 'weekly'],
    required: true,
  },
  category: { type: String, required: true },
  skill: { type: String, default: 'all' },
  minScorePercent: { type: Number, default: 0, min: 0, max: 100 },
  targetMin: { type: Number, required: true, min: 1 },
  targetMax: { type: Number, required: true, min: 1 },
  xpReward: { type: Number, default: 50 },
  icon: { type: String, default: 'flag' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true })

periodicQuestPoolSchema.index({ periodType: 1, status: 1 })

export default mongoose.model('PeriodicQuestPool', periodicQuestPoolSchema)
