import mongoose from 'mongoose'

const TARGET_TYPES = ['post', 'message', 'conversation', 'user']
const STATUS_VALUES = ['pending', 'reviewed', 'dismissed']

const contentReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Loại đối tượng bị báo cáo (một bảng / collection chung) */
    targetType: {
      type: String,
      enum: TARGET_TYPES,
      required: true,
      index: true,
    },
    /** _id của Post / Message / Conversation / User tương ứng */
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    /** Với message: lưu conversation để admin tra cứu nhanh */
    contextConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    reason: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, trim: true, maxlength: 2000, default: '' },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
)

contentReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 })

export const CONTENT_REPORT_TARGET_TYPES = TARGET_TYPES
export default mongoose.model('ContentReport', contentReportSchema)
