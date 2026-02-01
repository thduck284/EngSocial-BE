import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
  },
  content: { type: String, required: true, maxlength: 1000 },
  likeCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'deleted', 'flagged'],
    default: 'active',
  },
}, { timestamps: true })

commentSchema.index({ postId: 1, createdAt: 1 })
commentSchema.index({ parentId: 1 })
commentSchema.index({ authorId: 1 })

export default mongoose.model('Comment', commentSchema)
