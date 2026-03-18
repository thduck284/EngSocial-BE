import mongoose from 'mongoose'

/** Reaction type enum (stored in DB). Frontend maps these to emoji for display. */
export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry']
export const REACTION_TARGET_TYPES = ['post', 'comment']

const reactionSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: REACTION_TARGET_TYPES,
    required: true,
    index: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reaction: {
    type: String,
    enum: REACTION_TYPES,
    required: true,
  },
}, { timestamps: true, collection: 'reactions' })

reactionSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true })

export default mongoose.model('Reaction', reactionSchema)

