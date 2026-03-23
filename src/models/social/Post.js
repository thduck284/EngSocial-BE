import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    content: { type: String, required: true, maxlength: 5000 },
    images: [String],
    video: String,
    // documents: array of { url, name } or legacy string (url only)
    documents: [mongoose.Schema.Types.Mixed],
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    visibility: {
      type: String,
      enum: ['public', 'friends', 'group', 'private'],
      default: 'public',
    },
    status: {
      type: String,
      enum: ['active', 'hidden', 'deleted', 'flagged'],
      default: 'active',
    },
    tags: [String],
    // Mention references (for joins, reactions, etc.)
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Snapshot thông tin user được mention tại thời điểm tạo post
    mentionSnapshots: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        name: String,
        avatar: String,
      },
    ],
    // Optional reference to another post when this is a reshare
    sharedPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
  },
  { timestamps: true }
)

postSchema.index({ authorId: 1, createdAt: -1 })
postSchema.index({ groupId: 1, createdAt: -1 })
postSchema.index({ status: 1, createdAt: -1 })
postSchema.index({ content: 'text' })
postSchema.index({ tags: 1 })

export default mongoose.model('Post', postSchema)
