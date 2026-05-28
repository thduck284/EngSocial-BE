import { ChatbotConversation, ChatbotMessage } from '../models/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config()

const FLASK_MAX_HISTORY_TURNS = 3

function chatBotAppBaseUrl() {
  const raw = (process.env.CHAT_BOT_APP || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '')
}

/**
 * Cặp [user, assistant] cho Flask engsocial-ai (không gồm tin nhắn user hiện tại — đã lưu DB).
 */
async function buildFlaskHistoryPairs(conversationId) {
  const all = await ChatbotMessage.find({ conversationId }).sort({ createdAt: 1 }).lean()
  if (all.length < 2) return []
  const withoutLast = all.slice(0, -1)
  const pairs = []
  let pendingUser = null
  for (const m of withoutLast) {
    if (m.role === 'user') {
      pendingUser = m.content
    } else if (m.role === 'assistant' && pendingUser != null) {
      pairs.push([pendingUser, m.content])
      pendingUser = null
    }
  }
  return pairs.length > FLASK_MAX_HISTORY_TURNS
    ? pairs.slice(-FLASK_MAX_HISTORY_TURNS)
    : pairs
}

function flaskStreamHeaders(baseUrl) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/plain, */*',
  }
  if (/ngrok\.(app|io|dev)/i.test(baseUrl)) {
    headers['ngrok-skip-browser-warning'] = '69420'
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
  return headers
}

async function fetchChatBotAppReply(baseUrl, message, history) {
  const url = `${baseUrl}/api/chat/stream`
  const res = await fetch(url, {
    method: 'POST',
    headers: flaskStreamHeaders(baseUrl),
    body: JSON.stringify({ message, history }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`CHAT_BOT_HTTP_${res.status}: ${text.slice(0, 240)}`)
  }
  return text
}

async function openChatBotAppStream(baseUrl, message, history) {
  const url = `${baseUrl}/api/chat/stream`
  return fetch(url, {
    method: 'POST',
    headers: flaskStreamHeaders(baseUrl),
    body: JSON.stringify({ message, history }),
  })
}

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
 * Tạo / tải hội thoại và lưu tin user (dùng cho sendMessage + stream).
 */
async function createOrLoadConversationAndSaveUser(userId, { conversationId, message, skill, lessonId }) {
  let conversation
  let cid
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
    cid = conversation._id
  } else {
    conversation = await ChatbotConversation.findOne({ _id: conversationId, userId })
    if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
    cid = conversation._id
  }
  const userMessage = await ChatbotMessage.create({
    conversationId: cid,
    role: 'user',
    content: message,
  })
  return { conversation, conversationId: cid, userMessage }
}

/**
 * Stream trả lời: dòng 1 JSON meta, sau đó là text thuần (proxy Flask hoặc chunk Gemini).
 * Lưu assistant vào DB khi stream xong.
 */
export const pipeChatStream = async (userId, body, res) => {
  const { message, skill, lessonId, conversationId } = body
  const { conversation, conversationId: cid, userMessage } = await createOrLoadConversationAndSaveUser(userId, {
    conversationId,
    message,
    skill,
    lessonId,
  })
  const skillUsed = skill || conversation.skill

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const metaLine = JSON.stringify({
    type: 'meta',
    conversationId: cid.toString(),
    userMessage: {
      id: userMessage._id.toString(),
      role: 'user',
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
  })
  res.write(`${metaLine}\n`)

  let fullAssistant = ''
  try {
    const base = chatBotAppBaseUrl()
    if (base) {
      const history = await buildFlaskHistoryPairs(cid)
      const upstream = await openChatBotAppStream(base, message, history)
      if (!upstream.ok) {
        const errText = await upstream.text()
        fullAssistant = `[Lỗi ${upstream.status}: ${errText.slice(0, 300)}]`
        res.write(fullAssistant)
      } else if (!upstream.body) {
        fullAssistant = '[Lỗi: không có nội dung stream từ chat server.]'
        res.write(fullAssistant)
      } else {
        const reader = upstream.body.getReader()
        const dec = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = dec.decode(value, { stream: true })
          fullAssistant += chunk
          res.write(Buffer.from(chunk, 'utf8'))
        }
      }
    } else {
      const ai = await generateGeminiResponse(message, skillUsed, cid)
      fullAssistant = (ai.content || '').replace(/\r\n/g, '\n')
      const step = 40
      for (let i = 0; i < fullAssistant.length; i += step) {
        const part = fullAssistant.slice(i, i + step)
        res.write(part)
        await new Promise((r) => setImmediate(r))
      }
    }
  } catch (err) {
    const msg = err?.message || 'STREAM_FAILED'
    const tail = `\n[Lỗi: ${msg}]`
    fullAssistant += tail
    try {
      res.write(tail)
    } catch {
      /* client đã đóng */
    }
  }

  const trimmed = fullAssistant.trim() || '…'
  await ChatbotMessage.create({
    conversationId: cid,
    role: 'assistant',
    content: trimmed,
    data: {},
    actions: [],
  })
  conversation.messageCount = (conversation.messageCount || 0) + 2
  conversation.lastMessageAt = new Date()
  conversation.preview = message.substring(0, 200)
  await conversation.save()
  res.end()
}

/**
 * Send a message to chatbot and get AI response
 */
export const sendMessage = async (userId, { conversationId, message, skill, lessonId }) => {
  const { conversation, conversationId: cid, userMessage } = await createOrLoadConversationAndSaveUser(userId, {
    conversationId,
    message,
    skill,
    lessonId,
  })

  // Generate AI response
  const aiResponse = await generateAIResponse(message, skill || conversation.skill, cid)

  // Save AI response
  const assistantMessage = await ChatbotMessage.create({
    conversationId: cid,
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
    conversationId: cid.toString(),
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

/** Chỉ Gemini (dùng cho pipeChatStream khi không có CHAT_BOT_APP). */
async function generateGeminiResponse(message, skill, conversationId) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      content: 'AI Service currently unavailable (Missing API Key). How can I help you today?',
    }
  }

  try {
    const client = new GoogleGenAI({ apiKey })

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

/**
 * AI response: ưu tiên CHAT_BOT_APP (Flask/ngrok), fallback Gemini.
 */
async function generateAIResponse(message, skill, conversationId) {
  const kaggleBase = chatBotAppBaseUrl()
  if (kaggleBase) {
    try {
      const history = await buildFlaskHistoryPairs(conversationId)
      const raw = await fetchChatBotAppReply(kaggleBase, message, history)
      const cleaned = (raw || '').replace(/\r\n/g, '\n').trim()
      if (cleaned) {
        return { content: cleaned }
      }
    } catch (err) {
      console.warn('[chatbot] CHAT_BOT_APP failed, fallback Gemini:', err?.message || err)
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      content:
        kaggleBase
          ? 'Không nhận được phản hồi từ chat server (CHAT_BOT_APP). Kiểm tra tunnel ngrok và notebook đang chạy.'
          : 'AI Service currently unavailable (Missing API Key). How can I help you today?',
    }
  }

  return generateGeminiResponse(message, skill, conversationId)
}
