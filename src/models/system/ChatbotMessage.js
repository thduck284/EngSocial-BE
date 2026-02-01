import mongoose from 'mongoose'

const actionSchema = new mongoose.Schema({
  label: String,
  icon: String,
  action: String,
}, { _id: false })

const chatbotMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatbotConversation',
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: { type: String, required: true },
  data: {
    vocabulary: mongoose.Schema.Types.Mixed,
    grammar: mongoose.Schema.Types.Mixed,
    suggestions: [String],
  },
  actions: [actionSchema],
}, { timestamps: true })

chatbotMessageSchema.index({ conversationId: 1, createdAt: 1 })

export default mongoose.model('ChatbotMessage', chatbotMessageSchema)
