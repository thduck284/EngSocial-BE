import { ChatbotConversation, ChatbotMessage } from '../models/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config()

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

  // Generate AI response
  const aiResponse = await generateAIResponse(message, skill || conversation.skill, conversationId)

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
 * AI response generator using Gemini
 */
async function generateAIResponse(message, skill, conversationId) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      content: 'AI Service currently unavailable (Missing API Key). How can I help you today?',
    }
  }

  try {
    const client = new GoogleGenAI({ apiKey })

    // Get chat history for context
    const history = await ChatbotMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean()

    const systemPrompt = `You are a helpful English learning assistant on EngSocial. 
    Users talk to you to improve their English skills (specifically: ${skill}). 
    Keep responses friendly, educational, and encouraging. 
    If appropriate, provide vocabulary tips or correct the user's grammar in a helpful way.`

    const contents = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    contents.push({ role: 'user', parts: [{ text: message }] })

    const modelsToTry = [
      'gemini-3-flash-preview',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ]

    let lastError = null
    for (const modelName of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
          }
        })

        const content = response.text
        return { content }
      } catch (error) {
        console.warn(`Chat model ${modelName} failed, trying next...`, error.message)
        lastError = error
      }
    }

    throw lastError
  } catch (error) {
    console.error('Gemini Chat Error:', error)
    return {
      content: 'I am having some trouble connecting to my brain! All models are currently busy. Please try again in a moment.',
    }
  }
}
