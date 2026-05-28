import mongoose from 'mongoose'

const periodTypeEnum = ['daily', 'weekly']

const userPeriodicQuestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  periodType: { type: String, enum: periodTypeEnum, required: true },
  /** Khóa kỳ: daily YYYY-MM-DD, weekly YYYY-Www */
  periodKey: { type: String, required: true },
  slotIndex: { type: Number, required: true, min: 0 },
  /** Tiêu đề hiển thị do FE từ category/skill; có thể để rỗng */
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, required: true },
  skill: { type: String, default: 'all' },
  minScorePercent: { type: Number, default: 0, min: 0, max: 100 },
  targetMin: { type: Number, required: true, min: 1 },
  targetMax: { type: Number, required: true, min: 1 },
  effectiveTarget: { type: Number, required: true, min: 1 },
  currentCount: { type: Number, default: 0, min: 0 },
  xpReward: { type: Number, default: 50 },
  icon: { type: String, default: 'flag' },
  completed: { type: Boolean, default: false },
  /** Bản ghi kho đã chọn (debug / thống kê) */
  poolEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'PeriodicQuestPool', default: null },
}, { timestamps: true })

userPeriodicQuestSchema.index({ userId: 1, periodType: 1, periodKey: 1, slotIndex: 1 }, { unique: true })
userPeriodicQuestSchema.index({ userId: 1, periodType: 1, periodKey: 1 })

export default mongoose.model('UserPeriodicQuest', userPeriodicQuestSchema)
