import mongoose from 'mongoose'

/**
 * Per-user per-conversation bucket: what messages this user has "deleted" (hidden for me).
 * - deletedUpToCreatedAt: when user did "delete all", we store the createdAt of the last message at that time. Hide all messages with createdAt <= this.
 * - deletedMessageIds: individual message IDs this user deleted (single delete). When loading, exclude these.
 * No soft-delete on Message for "for me"; this bucket is the source of truth.
 */
const messageBucketSchema = new mongoose.Schema({
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
  /** When user "xóa toàn bộ": createdAt of the last message at that moment. Hide all messages with createdAt <= this. */
  deletedUpToCreatedAt: { type: Date, default: null },
  /** Single deletes: message IDs this user hid (same for own and others' messages). */
  deletedMessageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  }],
}, { timestamps: true })

messageBucketSchema.index({ userId: 1, conversationId: 1 }, { unique: true })

export default mongoose.model('MessageBucket', messageBucketSchema, 'conversationmessagebuckets')
