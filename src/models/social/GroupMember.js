import mongoose from 'mongoose'

const groupMemberSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin', 'owner'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'muted', 'banned'],
    default: 'active',
  },
  joinedAt: { type: Date, default: Date.now },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
})

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true })
groupMemberSchema.index({ userId: 1, status: 1 })

export default mongoose.model('GroupMember', groupMemberSchema)
