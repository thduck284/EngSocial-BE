import mongoose from 'mongoose'

const partySizeStatSchema = new mongoose.Schema({
  partySize: { type: Number, required: true },
  playedCount: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
}, { _id: false })

const userGameStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  gameKey: {
    type: String, // e.g., 'word-scramble'
    required: true,
  },
  // Overall stats for this game
  totalPlayed: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  
  // Stats broken down by partySize (2, 4, 6, 8...)
  statsByPartySize: [partySizeStatSchema],
  
  lastPlayedAt: { type: Date, default: Date.now },
}, { timestamps: true })

userGameStatsSchema.index({ userId: 1, gameKey: 1 }, { unique: true })

export default mongoose.model('UserGameStats', userGameStatsSchema)
