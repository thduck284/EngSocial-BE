import mongoose from 'mongoose'

const challengeParticipantSchema = new mongoose.Schema({
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  progress: { type: Number, default: 0 },
  target: Number,
  completed: { type: Boolean, default: false },
  rank: Number,
  xpEarned: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now },
  completedAt: Date,
})

challengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true })
challengeParticipantSchema.index({ challengeId: 1, progress: -1 })
challengeParticipantSchema.index({ userId: 1, completed: 1 })

export default mongoose.model('ChallengeParticipant', challengeParticipantSchema)
