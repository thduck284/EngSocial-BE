import mongoose from 'mongoose'

const userWordScrambleProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentStage: {
      type: Number,
      default: 1,
    },
    maxStageReached: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
)

export default mongoose.model('UserWordScrambleProgress', userWordScrambleProgressSchema)
