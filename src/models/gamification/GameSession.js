import mongoose from 'mongoose'

const gameAnswerSchema = new mongoose.Schema({
  questionId: String,
  answer: String,
  isCorrect: Boolean,
  timeSpent: Number,
}, { _id: false })

const gameSessionSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  score: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  totalQuestions: Number,
  streak: { type: Number, default: 0 },
  xpEarned: { type: Number, default: 0 },
  duration: Number, // seconds
  answers: [gameAnswerSchema],
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
})

gameSessionSchema.index({ gameId: 1, userId: 1, startedAt: -1 })
gameSessionSchema.index({ gameId: 1, score: -1 })
gameSessionSchema.index({ userId: 1, startedAt: -1 })

export default mongoose.model('GameSession', gameSessionSchema)
