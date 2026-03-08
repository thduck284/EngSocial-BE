import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
}, { timestamps: true })

// Direct: exactly 2 participants, unique pair (sorted)
conversationSchema.index({ participants: 1, type: 1 }, { unique: true })

export default mongoose.model('Conversation', conversationSchema)
