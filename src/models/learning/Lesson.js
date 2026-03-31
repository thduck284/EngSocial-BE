import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  id: String,
  question: { type: String, required: true },
  type: {
    type: String,
    enum: ['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering'],
    required: true,
  },
  options: [{
    value: String,
    text: String,
  }],
  correctAnswer: mongoose.Schema.Types.Mixed, // String or Array
  explanation: String,
  points: { type: Number, default: 10 },
}, { _id: false })

const vocabularySchema = new mongoose.Schema({
  word: String,
  phonetic: String,
  meaning: String,
  meaningVi: String,
  example: String,
  audioUrl: String,
}, { _id: false })

const chapterSchema = new mongoose.Schema({
  id: String,
  label: String,
  time: String,
  startTime: Number,
}, { _id: false })

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing'],
    required: true,
  },
  level: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    required: true,
  },
  // Phân loại: lesson (bài học) | practice (bài luyện)
  category: {
    type: String,
    enum: ['lesson', 'practice'],
    default: 'lesson',
  },
  topic: String,
  description: {
    type: String,
    maxlength: 1000,
  },
  thumbnail: String,
  
  // Content varies by skill type
  content: {
    // Reading
    text: String,
    translationVi: String, // Bản dịch tiếng Việt đoạn đọc (optional)
    wordCount: Number,
    
    // Listening
    audioUrl: String,
    transcript: String,
    duration: Number, // seconds
    accent: {
      type: String,
      enum: ['', 'american', 'british', 'australian'],
    },
    speed: { type: Number, default: 1.0 },
    chapters: [chapterSchema],
    
    // Writing
    prompt: String,
    wordLimit: {
      min: Number,
      max: Number,
    },
    sampleAnswer: String,
  },
  
  questions: [questionSchema],
  vocabulary: [vocabularySchema],
  
  // Metadata
  estimatedTime: Number, // minutes
  xpReward: { type: Number, default: 50 },
  totalQuestions: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  completionCount: { type: Number, default: 0 },
  
  status: {
    type: String,
    enum: ['published'],
    default: 'published',
  },
  featured: { type: Boolean, default: false },
  // Practice-specific (cho category=practice)
  time: { type: String, default: '10m' }, // e.g. "15m", "30 min"
  accent: { type: String, default: '' }, // Listening accent
  practiceType: { type: String, default: '' }, // e.g. "Email Practice", "Essay"
  length: { type: String, default: '' }, // e.g. "100-150 words"
  order: { type: Number, default: 0 },
  tags: [String],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  publishedAt: Date,
}, {
  timestamps: true,
})

// Indexes (slug đã có unique: true trong schema)
lessonSchema.index({ skill: 1, status: 1 })
lessonSchema.index({ category: 1, skill: 1, status: 1 })
lessonSchema.index({ skill: 1, level: 1 })
lessonSchema.index({ topic: 1 })
lessonSchema.index({ featured: 1, status: 1 })
lessonSchema.index({ rating: -1 })
lessonSchema.index({ completionCount: -1 })
lessonSchema.index({ title: 'text', description: 'text' })
lessonSchema.index({ tags: 1 })

export default mongoose.model('Lesson', lessonSchema)
