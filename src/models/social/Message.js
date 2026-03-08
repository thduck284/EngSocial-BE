import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    default: '',
    trim: true,
  },
  attachments: [{
    url: { type: String, required: true },
    name: { type: String, default: null },
    type: { type: String, default: null },
  }],
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  reactions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, trim: true },
  }],
  /** Xóa cho mọi người (chỉ người gửi, xóa mềm) */
  deletedAt: { type: Date, default: null },
}, { timestamps: true })

messageSchema.index({ conversationId: 1, createdAt: 1 })

export default mongoose.model('Message', messageSchema)
