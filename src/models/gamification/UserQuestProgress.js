import mongoose from 'mongoose'

/**
 * Tiến độ quest theo user — currentCount + mục tiêu trong kỳ (effectiveTarget, có thể random trong [targetMin,targetMax]).
 * periodKey giữ cố định '_' (không còn reset theo lịch từ cấu hình quest).
 */
const userQuestProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quest', required: true },
  currentCount: { type: Number, default: 0, min: 0 },
  /** Khóa kỳ reset: YYYY-Www | YYYY-MM | '_' nếu không reset theo lịch */
  periodKey: { type: String, default: '' },
  /** Mục tiêu trong kỳ hiện tại (random trong khoảng min–max khi bắt đầu kỳ) */
  effectiveTarget: { type: Number, min: 1, default: 1 },
}, { timestamps: true })

userQuestProgressSchema.index({ userId: 1, questId: 1 }, { unique: true })

export default mongoose.model('UserQuestProgress', userQuestProgressSchema)
