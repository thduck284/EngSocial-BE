import mongoose from 'mongoose'

const mockTestResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lessonResults: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserLessonProgress',
  }],
  // We store a copy of the lessons involved for quick reference
  lessons: [{
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    skill: String,
    title: String
  }],
  overallScore: { type: Number, default: 0 },
  maxTotalScore: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['completed', 'graded'],
    default: 'completed'
  },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true })

export default mongoose.model('MockTestResult', mockTestResultSchema)
