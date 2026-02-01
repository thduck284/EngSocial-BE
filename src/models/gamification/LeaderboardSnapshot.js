import mongoose from 'mongoose'

const entrySchema = new mongoose.Schema({
  rank: Number,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  name: String,
  avatar: String,
  xp: Number,
  level: Number,
}, { _id: false })

const leaderboardSnapshotSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['weekly', 'monthly', 'all_time'],
    required: true,
  },
  period: { type: String, required: true }, // e.g., "2024-W48", "2024-11"
  entries: [entrySchema],
  generatedAt: { type: Date, default: Date.now },
})

leaderboardSnapshotSchema.index({ type: 1, period: 1 }, { unique: true })

export default mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema)
