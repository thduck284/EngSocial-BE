import mongoose from 'mongoose'

const conversationSettingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  /** Mute notifications until this date (null = not muted) */
  mutedUntil: { type: Date, default: null },
  /** Disappearing messages until this date (null = off) */
  disappearingUntil: { type: Date, default: null },
  /** Số giây tin nhắn được giữ (1h=3600, 8h=28800, 24h=86400). Tin cũ hơn sẽ bị xóa thật khi user offline 5p. */
  disappearingDurationSeconds: { type: Number, default: null },
}, { timestamps: true })

conversationSettingSchema.index({ userId: 1, conversationId: 1 }, { unique: true })

export default mongoose.model('ConversationSetting', conversationSettingSchema)
