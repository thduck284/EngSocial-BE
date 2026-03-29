import mongoose from 'mongoose'

const answerSchema = new mongoose.Schema({
  questionId: String,
  questionIndex: Number,
  answer: mongoose.Schema.Types.Mixed,
  isCorrect: Boolean,
  answeredAt: Date,
}, { _id: false })

const noteSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  category: { type: String, enum: ['grammar', 'vocab', 'idea'], default: 'grammar' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const attemptHistorySchema = new mongoose.Schema({
  type: { type: String, enum: ['quiz', 'writing'], required: true },
  attemptNo: { type: Number, required: true },
  submittedAt: { type: Date, default: Date.now },
  score: Number,
  maxScore: Number,
  progress: Number,
  xpEarned: { type: Number, default: 0 },
  timeSpent: Number,
  answers: [answerSchema],
  submission: {
    content: String,
    wordCount: Number,
  },
}, { _id: false })

const userLessonProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  currentPosition: Number, // For audio/video
  currentChapter: String,
  submission: {
    content: String,
    wordCount: Number,
    submittedAt: Date,
    feedback: String,
    score: Number,
  },
  score: { type: Number, default: 0 },
  maxScore: Number,
  xpEarned: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  timeSpent: { type: Number, default: 0 }, // seconds
  startedAt: Date,
  completedAt: Date,
  lastAccessedAt: Date,
  notes: [noteSchema],
  attemptHistory: [attemptHistorySchema],
}, { timestamps: true })

userLessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true })
userLessonProgressSchema.index({ userId: 1, status: 1 })
userLessonProgressSchema.index({ lessonId: 1, score: -1 })

export default mongoose.model('UserLessonProgress', userLessonProgressSchema)
