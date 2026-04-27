import mongoose from 'mongoose'

/** Giá trị `condition.filters.category` — giữ đồng bộ với quest.controller normalizeCondition */
export const QUEST_FILTER_CATEGORIES = [
  'all',
  'lesson',
  'practice',
  'friends',
  'vocabulary_notes',
  'community_post',
  'login_streak',
  'online_time',
]

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
    /** Giữ field legacy; đồng bộ với targetMin khi lưu qua controller */
    target: { type: Number, required: true, min: 1, default: 1 },
    targetMin: { type: Number, min: 1, default: 1 },
    targetMax: { type: Number, min: 1, default: 1 },
    filters: {
      skill: { type: String, enum: ['reading', 'listening', 'writing', 'all'], default: 'all' },
      category: {
        type: String,
        enum: QUEST_FILTER_CATEGORIES,
        default: 'all',
      },
      /** Ngưỡng % điểm (score/max*100) — trùng ý nghĩa với progress bài học trong hệ thống; không dùng field minProgress riêng. */
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
