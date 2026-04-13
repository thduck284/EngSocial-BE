import mongoose from 'mongoose'

const lessonReviewSchema = new mongoose.Schema({
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  comment: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
}, { timestamps: true })

// Ensure that a user can only review a lesson once
lessonReviewSchema.index({ lessonId: 1, userId: 1 }, { unique: true })
lessonReviewSchema.index({ lessonId: 1, createdAt: -1 })

export default mongoose.model('LessonReview', lessonReviewSchema)
