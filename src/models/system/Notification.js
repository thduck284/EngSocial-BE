import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['comment', 'like', 'comment_like', 'follow', 'challenge', 'achievement', 'goal', 'system', 'friend_request', 'friend_request_accepted', 'group_invite', 'post_mention', 'post_shared'],
    required: true,
  },
  title: String,
  message: String,
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedType: {
    type: String,
    enum: ['post', 'lesson', 'challenge', 'achievement', 'user', 'group'],
  },
  read: { type: Boolean, default: false },
  readAt: Date,
  data: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }) // 30 days TTL

export default mongoose.model('Notification', notificationSchema)
