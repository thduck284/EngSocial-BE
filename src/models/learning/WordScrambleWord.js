import mongoose from 'mongoose'

const wordScrambleWordSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 80,
      match: /^[a-z]+$/,
    },
    meaning: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    example: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard'],
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
)

wordScrambleWordSchema.index({ word: 1 }, { unique: true })
wordScrambleWordSchema.index({ difficulty: 1, isActive: 1 })
wordScrambleWordSchema.index({ topic: 1, difficulty: 1, isActive: 1 })

export default mongoose.model('WordScrambleWord', wordScrambleWordSchema)
