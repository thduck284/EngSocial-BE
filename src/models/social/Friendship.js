import mongoose from 'mongoose'

const friendshipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'blocked'],
    default: 'pending',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acceptedAt: Date,
}, { timestamps: true })

friendshipSchema.index({ userId: 1, friendId: 1 }, { unique: true })
friendshipSchema.index({ userId: 1, status: 1 })
friendshipSchema.index({ friendId: 1, status: 1 })

export default mongoose.model('Friendship', friendshipSchema)
