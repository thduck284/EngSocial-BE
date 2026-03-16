import mongoose from 'mongoose'

/** Reaction type enum (stored in DB). Frontend maps these to emoji for display. */
export const POST_REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry']

const postReactionSchema = new mongoose.Schema({
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
  reaction: {
    type: String,
    enum: POST_REACTION_TYPES,
    required: true,
  },
}, { timestamps: true, collection: 'post_reactions' })

postReactionSchema.index({ postId: 1, userId: 1 }, { unique: true })

export default mongoose.model('PostReaction', postReactionSchema)
