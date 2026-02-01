import mongoose from 'mongoose'

const postLikeSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true })

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true })

export default mongoose.model('PostLike', postLikeSchema)
