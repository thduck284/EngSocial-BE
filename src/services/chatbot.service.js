import { Agent, fetch as undiciFetch } from 'undici'
import { ChatbotConversation, ChatbotMessage } from '../models/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { resolveReplyLanguage } from '../utils/detectMessageLanguage.js'
import dotenv from 'dotenv'

dotenv.config()

let _chatBotTlsAgent = null

function isNgrokHost(url) {
  return /ngrok/i.test(url || '')
}

/** Node → ngrok hay lỗi UNABLE_TO_VERIFY_LEAF_SIGNATURE; tự bật khi URL là ngrok. */
function chatBotTlsInsecureEnabled() {
  const flag = (process.env.CHAT_BOT_TLS_INSECURE || '').trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'no') return false
  if (flag === '1' || flag === 'true' || flag === 'yes') return true
  return isNgrokHost(process.env.CHAT_BOT_APP || '')
}

function chatBotTlsAgent() {
  if (!chatBotTlsInsecureEnabled()) return null
  if (!_chatBotTlsAgent) {
    _chatBotTlsAgent = new Agent({
      connect: { rejectUnauthorized: false },
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
    })
  }
  return _chatBotTlsAgent
}

function chatBotAbortSignal(timeoutMs) {
  const ms = Math.max(0, Number(timeoutMs) || 0)
  if (!ms) return undefined
  if (typeof AbortSignal.timeout === 'function') {
    try {
      return AbortSignal.timeout(ms)
    } catch {
      /* fall through */
    }
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  if (typeof timer.unref === 'function') timer.unref()
  return ac.signal
}

function chatBotFetch(url, init = {}) {
  if (!url || typeof url !== 'string') {
    return Promise.reject(new TypeError('Invalid chat bot URL'))
  }
  const agent = chatBotTlsAgent()
  // Dùng undici.fetch + Agent cùng package — tránh UND_ERR_INVALID_ARG khi mix global fetch với Agent lệch version (Render).
  if (agent) {
    return undiciFetch(url, { ...init, dispatcher: agent })
  }
  return fetch(url, init)
}

const FLASK_MAX_HISTORY_TURNS = 3

/** Base URL Flask (không kèm path). CHAT_BOT_APP chỉ là origin ngrok, ví dụ https://xxxx.ngrok-free.app */
function chatBotAppBaseUrl() {
  const raw = (process.env.CHAT_BOT_APP || '').trim()
  if (!raw) return ''
  let base = raw.replace(/\/+$/, '')
  // Gỡ path sai nếu dán nhầm URL backend EngSocial
  base = base.replace(/\/api\/chatbot\/chat\/stream$/i, '')
  base = base.replace(/\/api\/chatbot\/chat$/i, '')
  base = base.replace(/\/api\/chatbot$/i, '')
  base = base.replace(/\/api\/chat\/stream$/i, '')
  return base.replace(/\/+$/, '')
}

/** Endpoint Flask đúng: {CHAT_BOT_APP}/api/chat/stream (không phải /api/chatbot/chat/stream). */
function chatBotStreamUrl() {
  const base = chatBotAppBaseUrl()
  if (!base) return ''
  try {
    return new URL('/api/chat/stream', `${base}/`).href
  } catch {
    console.warn('[chatbot] Invalid CHAT_BOT_APP:', base)
    return ''
  }
}

function chatBotFetchErrorDetail(err) {
  const parts = [(err?.message || String(err)).trim()]
  const code = err?.cause?.code || err?.code
  if (code) parts.push(String(code))
  return parts.filter(Boolean).join(' — ')
}

function chatBotUnavailableMessage(err) {
  const base = chatBotAppBaseUrl()
  if (!base) {
    return 'Chat server chưa được cấu hình. Thêm CHAT_BOT_APP vào file .env của backend.'
  }
  const detail = chatBotFetchErrorDetail(err)
  if (/UNABLE_TO_VERIFY|certificate|CERT_/i.test(detail)) {
    return 'Lỗi SSL khi gọi ngrok từ Node. Đặt CHAT_BOT_TLS_INSECURE=1 trên Render/local (hoặc dùng URL ngrok — BE sẽ tự bật).'
  }
  if (/UND_ERR_INVALID_ARG/i.test(detail)) {
    return 'Lỗi kết nối chat server (cấu hình HTTP client). Redeploy backend mới nhất và kiểm tra CHAT_BOT_APP chỉ là origin ngrok, không có dấu ngoặc/thừa khoảng trắng.'
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|AbortError/i.test(detail)) {
    return 'Không kết nối được chat server. Hãy chạy test.py (hoặc app_chatbot.py), bật ngrok và cập nhật URL mới vào CHAT_BOT_APP trong .env.'
  }
  if (detail) {
    return `Không kết nối được chat server: ${detail}`
  }
  return 'Không nhận được phản hồi từ chat server. Kiểm tra CHAT_BOT_APP và server đang chạy.'
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
  if (isNgrokHost(baseUrl)) {
    headers['ngrok-skip-browser-warning'] = '69420'
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
  return headers
}

function flaskChatPayload(message, history, replyLanguage) {
  return JSON.stringify({
    message,
    history,
    replyLanguage: replyLanguage === 'en' ? 'en' : 'vi',
  })
}

async function fetchChatBotAppReply(message, history, replyLanguage) {
  const url = chatBotStreamUrl()
  if (!url) throw new Error('CHAT_BOT_APP_NOT_CONFIGURED')
  const res = await chatBotFetch(url, {
    method: 'POST',
    headers: flaskStreamHeaders(url),
    body: flaskChatPayload(message, history, replyLanguage),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`CHAT_BOT_HTTP_${res.status}: ${text.slice(0, 240)}`)
  }
  return text
}

async function openChatBotAppStream(message, history, replyLanguage) {
  const url = chatBotStreamUrl()
  if (!url) throw new Error('CHAT_BOT_APP_NOT_CONFIGURED')
  return chatBotFetch(url, {
    method: 'POST',
    headers: flaskStreamHeaders(url),
    body: flaskChatPayload(message, history, replyLanguage),
    signal: chatBotAbortSignal(300_000),
  })
}

/** Đọc stream từ Flask CHAT_BOT_APP; trả text đầy đủ. */
async function streamFromChatBotApp(res, message, history, replyLanguage) {
  const upstream = await openChatBotAppStream(message, history, replyLanguage)
  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    throw new Error(`HTTP ${upstream.status}: ${errText.slice(0, 200) || 'upstream error'}`)
  }
  if (!upstream.body) {
    throw new Error('EMPTY_BODY')
  }
  let full = ''
  const reader = upstream.body.getReader()
  const dec = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = dec.decode(value, { stream: true })
    full += chunk
    res.write(Buffer.from(chunk, 'utf8'))
    if (typeof res.flush === 'function') {
      res.flush()
    }
  }
  const trimmed = full.trim()
  if (!trimmed || /^\[Lỗi/i.test(trimmed)) {
    throw new Error('EMPTY_OR_ERROR_PAYLOAD')
  }
  return full
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
 * Stream trả lời: dòng 1 JSON meta, sau đó là text thuần (proxy CHAT_BOT_APP).
 * Lưu assistant vào DB khi stream xong.
 */
export const pipeChatStream = async (userId, body, res) => {
  const { message, skill, lessonId, conversationId, replyLanguage: replyLangBody } = body
  const replyLanguage = resolveReplyLanguage(message, replyLangBody)
  const { conversation, conversationId: cid, userMessage } = await createOrLoadConversationAndSaveUser(userId, {
    conversationId,
    message,
    skill,
    lessonId,
  })
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
    if (!chatBotStreamUrl()) {
      throw new Error('CHAT_BOT_APP_NOT_CONFIGURED')
    }
    const history = await buildFlaskHistoryPairs(cid)
    fullAssistant = await streamFromChatBotApp(res, message, history, replyLanguage)
  } catch (err) {
    console.warn('[chatbot] CHAT_BOT_APP failed:', chatBotStreamUrl(), chatBotFetchErrorDetail(err))
    fullAssistant = chatBotUnavailableMessage(err)
    try {
      res.write(fullAssistant)
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
export const sendMessage = async (userId, { conversationId, message, skill, lessonId, replyLanguage: replyLangBody }) => {
  const replyLanguage = resolveReplyLanguage(message, replyLangBody)
  const { conversation, conversationId: cid, userMessage } = await createOrLoadConversationAndSaveUser(userId, {
    conversationId,
    message,
    skill,
    lessonId,
  })

  // Generate AI response
  const aiResponse = await generateAIResponse(message, skill || conversation.skill, cid, replyLanguage)

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

/** Phản hồi qua CHAT_BOT_APP (Flask / ngrok) — không dùng Gemini. */
async function generateAIResponse(message, skill, conversationId, replyLanguage = 'vi') {
  if (!chatBotStreamUrl()) {
    return { content: chatBotUnavailableMessage() }
  }
  try {
    const history = await buildFlaskHistoryPairs(conversationId)
    const raw = await fetchChatBotAppReply(message, history, replyLanguage)
    const cleaned = (raw || '').replace(/\r\n/g, '\n').trim()
    if (cleaned && !/^\[Lỗi/i.test(cleaned)) {
      return { content: cleaned }
    }
    return { content: chatBotUnavailableMessage() }
  } catch (err) {
    console.warn('[chatbot] CHAT_BOT_APP failed:', chatBotStreamUrl(), chatBotFetchErrorDetail(err))
    return { content: chatBotUnavailableMessage(err) }
  }
}
