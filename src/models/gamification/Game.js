import mongoose from 'mongoose'

const gameSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  titleVi: String,
  description: String,
  descriptionVi: String,
  type: {
    type: String,
    enum: ['vocabulary', 'grammar', 'mixed', 'quiz'],
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  icon: String,
  color: String,
  bgColor: String,
  playCount: { type: Number, default: 0 },
  currentPlaying: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  config: {
    timeLimit: Number,
    questionsPerRound: Number,
    xpPerCorrect: Number,
    streakBonus: Boolean,
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'disabled'],
    default: 'active',
  },
  featured: { type: Boolean, default: false },
}, { timestamps: true })

gameSchema.index({ type: 1, status: 1 })
gameSchema.index({ featured: 1, status: 1 })

export default mongoose.model('Game', gameSchema)
