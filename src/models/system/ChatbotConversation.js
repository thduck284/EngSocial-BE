import mongoose from 'mongoose'

const chatbotConversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: String,
  preview: String,
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'general'],
    default: 'general',
  },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: Date,
}, { timestamps: true })

chatbotConversationSchema.index({ userId: 1, lastMessageAt: -1 })

export default mongoose.model('ChatbotConversation', chatbotConversationSchema)
