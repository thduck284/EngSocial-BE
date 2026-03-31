import mongoose from 'mongoose'

export const VOCAB_PRACTICE_MODES = ['detail', 'flashcard', 'learn', 'test', 'match', 'data']

const itemSchema = new mongoose.Schema(
  {
    topicId: { type: String, required: true },
    practiceMode: { type: String, required: true, enum: VOCAB_PRACTICE_MODES },
    deck: { type: String, default: null, maxlength: 120 },
    visitedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const userVocabRecentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
)

export default mongoose.model('UserVocabRecent', userVocabRecentSchema)
