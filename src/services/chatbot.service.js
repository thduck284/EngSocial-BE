import { ChatbotConversation, ChatbotMessage } from '../models/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Get user's chatbot conversations
 */
export const getConversations = async (userId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await ChatbotConversation.countDocuments({ userId })
  const conversations = await ChatbotConversation.find({ userId })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    conversations: conversations.map(c => ({
      id: c._id.toString(),
      title: c.title,
      preview: c.preview,
      skill: c.skill,
      messageCount: c.messageCount,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get messages in a conversation
 */
export const getMessages = async (userId, conversationId, { page = 1, limit = 50 }) => {
  const conversation = await ChatbotConversation.findOne({ _id: conversationId, userId })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await ChatbotMessage.countDocuments({ conversationId })
  const messages = await ChatbotMessage.find({ conversationId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(perPage)

  return {
    conversation: {
      id: conversation._id.toString(),
      title: conversation.title,
      skill: conversation.skill,
    },
    messages: messages.map(m => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      data: m.data,
      actions: m.actions,
      createdAt: m.createdAt,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Send a message to chatbot and get AI response
 */
export const sendMessage = async (userId, { conversationId, message, skill, lessonId }) => {
  let conversation

  // Create new conversation if no conversationId
  if (!conversationId) {
    conversation = await ChatbotConversation.create({
      userId,
      title: message.substring(0, 100),
      preview: message.substring(0, 200),
      skill: skill || 'general',
      lessonId,
      messageCount: 0,
      lastMessageAt: new Date(),
    })
    conversationId = conversation._id
  } else {
    conversation = await ChatbotConversation.findOne({ _id: conversationId, userId })
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  }

  // Save user message
  const userMessage = await ChatbotMessage.create({
    conversationId,
    role: 'user',
    content: message,
  })

  // Generate AI response (placeholder - integrate with actual AI service)
  const aiResponse = generateAIResponse(message, skill || conversation.skill)

  // Save AI response
  const assistantMessage = await ChatbotMessage.create({
    conversationId,
    role: 'assistant',
    content: aiResponse.content,
    data: aiResponse.data || {},
    actions: aiResponse.actions || [],
  })

  // Update conversation
  conversation.messageCount = (conversation.messageCount || 0) + 2
  conversation.lastMessageAt = new Date()
  conversation.preview = message.substring(0, 200)
  await conversation.save()

  return {
    conversationId: conversationId.toString(),
    userMessage: {
      id: userMessage._id.toString(),
      role: 'user',
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      id: assistantMessage._id.toString(),
      role: 'assistant',
      content: assistantMessage.content,
      data: assistantMessage.data,
      actions: assistantMessage.actions,
      createdAt: assistantMessage.createdAt,
    },
  }
}

/**
 * Delete a conversation
 */
export const deleteConversation = async (userId, conversationId) => {
  const conversation = await ChatbotConversation.findOne({ _id: conversationId, userId })
  if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
  await ChatbotMessage.deleteMany({ conversationId })
  await ChatbotConversation.deleteOne({ _id: conversationId })
  return true
}

/**
 * Placeholder AI response generator
 * TODO: Replace with actual AI API integration (OpenAI, Gemini, etc.)
 */
function generateAIResponse(message, skill) {
  const lowerMsg = message.toLowerCase()

  // Learning path suggestions
  if (lowerMsg.includes('lộ trình') || lowerMsg.includes('learning path') || lowerMsg.includes('bắt đầu')) {
    return {
      content: 'Đây là lộ trình học tiếng Anh gợi ý cho bạn:\n\n1. **Cơ bản (A1-A2):** Học từ vựng cơ bản, ngữ pháp đơn giản\n2. **Trung cấp (B1-B2):** Luyện đọc hiểu, nghe hiểu, viết đoạn văn\n3. **Nâng cao (C1-C2):** Kỹ năng giao tiếp, viết luận, đọc báo\n\nBạn muốn bắt đầu từ level nào?',
      actions: [
        { label: 'Bắt đầu A1', icon: '🌱', action: 'start_level_a1' },
        { label: 'Kiểm tra trình độ', icon: '📋', action: 'placement_test' },
        { label: 'Xem kỹ năng', icon: '📚', action: 'view_skills' },
      ],
    }
  }

  // Vocabulary help
  if (lowerMsg.includes('từ vựng') || lowerMsg.includes('vocabulary') || lowerMsg.includes('word')) {
    return {
      content: 'Tôi có thể giúp bạn học từ vựng! Hãy cho tôi biết chủ đề bạn muốn học.',
      data: {
        suggestions: ['Travel', 'Business', 'Daily Life', 'Technology', 'Food'],
      },
      actions: [
        { label: 'Flashcard', icon: '🃏', action: 'flashcard_mode' },
        { label: 'Trắc nghiệm', icon: '✅', action: 'quiz_mode' },
        { label: 'Game từ vựng', icon: '🎮', action: 'vocab_game' },
      ],
    }
  }

  // Grammar help
  if (lowerMsg.includes('ngữ pháp') || lowerMsg.includes('grammar') || lowerMsg.includes('tense')) {
    return {
      content: 'Ngữ pháp tiếng Anh có nhiều chủ đề. Bạn muốn ôn tập về gì?\n\n- **Thì (Tenses):** Present, Past, Future\n- **Câu điều kiện (Conditionals)**\n- **Câu bị động (Passive Voice)**\n- **Mệnh đề quan hệ (Relative Clauses)**',
      data: {
        grammar: { topics: ['tenses', 'conditionals', 'passive', 'relative_clauses'] },
      },
      actions: [
        { label: 'Ôn thì', icon: '⏰', action: 'review_tenses' },
        { label: 'Bài tập', icon: '📝', action: 'grammar_exercises' },
      ],
    }
  }

  // Default response
  return {
    content: `Tôi là trợ lý học tiếng Anh của EngSocial! Tôi có thể giúp bạn:\n\n- 📚 Gợi ý lộ trình học\n- 📖 Học từ vựng theo chủ đề\n- ✍️ Ôn tập ngữ pháp\n- 🎯 Luyện kỹ năng đọc, nghe, viết\n\nHãy hỏi tôi bất cứ điều gì liên quan đến tiếng Anh!`,
    actions: [
      { label: 'Lộ trình học', icon: '🗺️', action: 'learning_path' },
      { label: 'Học từ vựng', icon: '📖', action: 'vocabulary' },
      { label: 'Ngữ pháp', icon: '✍️', action: 'grammar' },
    ],
  }
}
