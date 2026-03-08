import mongoose from 'mongoose'
import { Conversation, MessageBucket, ConversationSetting, Message, User } from '../models/index.js'

/**
 * Get or create a direct conversation between current user and other user.
 * @returns { conversation, otherUser: { id, name, avatar }, messages }
 */
export const getOrCreateConversation = async (myId, otherUserId) => {
  await ensureUserAccessedAndRunDisappearingCleanup(myId)
  const myIdObj = mongoose.Types.ObjectId.isValid(myId) ? new mongoose.Types.ObjectId(myId) : null
  const otherId = mongoose.Types.ObjectId.isValid(otherUserId) ? new mongoose.Types.ObjectId(otherUserId) : null
  if (!myIdObj || !otherId) throw new Error('USER_NOT_FOUND')
  if (myIdObj.equals(otherId)) throw new Error('CANNOT_CHAT_SELF')

  const other = await User.findById(otherId).select('name avatar').lean()
  if (!other) throw new Error('USER_NOT_FOUND')

  const participants = [myIdObj, otherId].sort((a, b) => a.toString().localeCompare(b.toString()))
  let conversation = await Conversation.findOne({
    type: 'direct',
    participants: { $all: participants, $size: 2 },
  })
    .lean()

  if (!conversation) {
    const created = await Conversation.create({
      type: 'direct',
      participants,
    })
    conversation = created.toObject()
  }

  const notDeletedForEveryone = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
  const allMessages = await Message.find({ conversationId: conversation._id, ...notDeletedForEveryone }).sort({ createdAt: 1 }).lean()
  const bucket = await getBucket(conversation._id.toString(), myId)
  const cutoff = bucket.deletedUpToCreatedAt ? new Date(bucket.deletedUpToCreatedAt) : null
  const deletedSet = new Set(bucket.deletedMessageIds || [])
  const messages = allMessages.filter((m) => {
    if (deletedSet.has(m._id.toString())) return false
    if (cutoff && m.createdAt <= cutoff) return false
    return true
  })

  const otherUser = {
    id: other._id.toString(),
    name: other.name || 'User',
    avatar: other.avatar || null,
  }

  const setting = await ConversationSetting.findOne({
    userId: myIdObj,
    conversationId: conversation._id,
  }).lean()
  const now = new Date()
  const muted = !!(setting?.mutedUntil && new Date(setting.mutedUntil) > now) || setting?.muted === true
  const disappearing = !!(setting?.disappearingUntil && new Date(setting.disappearingUntil) > now)
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
  const lastMessageText = lastMsg
    ? (lastMsg.content?.trim?.()?.slice(0, 200) || (lastMsg.attachments?.length ? `[${lastMsg.attachments.length} file]` : '') || '')
    : ''
  const lastMessageAt = lastMsg?.createdAt ?? null
  return {
    conversation: {
      id: conversation._id.toString(),
      type: conversation.type,
      lastMessageAt,
      lastMessageText,
      muted,
      mutedUntil: setting?.mutedUntil ?? null,
      disappearing,
      disappearingUntil: setting?.disappearingUntil ?? null,
    },
    otherUser,
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      content: m.content,
      createdAt: m.createdAt,
      readBy: (m.readBy || []).map((id) => id.toString()),
      attachments: normalizeAttachments(m),
      reactions: (m.reactions || []).map((r) => ({ userId: r.userId?.toString(), emoji: r.emoji })),
    })),
  }
}

/**
 * Get list of conversations for current user (with last message and other participant for direct).
 * Nếu user vừa offline >= 5p thì chạy xóa thật tin nhắn tự xóa hết hạn.
 */
export const getMyConversations = async (userId) => {
  await ensureUserAccessedAndRunDisappearingCleanup(userId)
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return []
  const list = await Conversation.find({
    participants: userIdObj,
    type: 'direct',
  })
    .lean()

  const settingsMap = new Map()
  const bucketMap = new Map()
  const now = new Date()
  if (list.length > 0) {
    const [settings, buckets] = await Promise.all([
      ConversationSetting.find({
        userId: userIdObj,
        conversationId: { $in: list.map((c) => c._id) },
      }).lean(),
      MessageBucket.find({
        userId: userIdObj,
        conversationId: { $in: list.map((c) => c._id) },
      }).lean(),
    ])
    settings.forEach((s) => {
      const muted = !!(s.mutedUntil && new Date(s.mutedUntil) > now) || s.muted === true
      const disappearing = !!(s.disappearingUntil && new Date(s.disappearingUntil) > now)
      settingsMap.set(s.conversationId.toString(), { muted, mutedUntil: s.mutedUntil, disappearing, disappearingUntil: s.disappearingUntil })
    })
    buckets.forEach((b) => {
      bucketMap.set(b.conversationId.toString(), {
        deletedUpToCreatedAt: b.deletedUpToCreatedAt,
        deletedMessageIds: b.deletedMessageIds || [],
      })
    })
  }

  const result = await Promise.all(
    list.map(async (c) => {
      const otherId = c.participants.find((p) => p.toString() !== userIdObj.toString())
      const other = await User.findById(otherId).select('name avatar').lean()
      const bucket = bucketMap.get(c._id.toString()) || { deletedUpToCreatedAt: null, deletedMessageIds: [] }
      const visibleFilter = {
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
        ...(bucket.deletedUpToCreatedAt ? { createdAt: { $gt: bucket.deletedUpToCreatedAt } } : {}),
        ...(bucket.deletedMessageIds?.length ? { _id: { $nin: bucket.deletedMessageIds } } : {}),
      }
      const unreadCount = await Message.countDocuments({
        conversationId: c._id,
        senderId: { $ne: userIdObj },
        readBy: { $nin: [userIdObj] },
        ...visibleFilter,
      })
      const lastMsg = await Message.findOne({
        conversationId: c._id,
        ...visibleFilter,
      })
        .sort({ createdAt: -1 })
        .lean()
      const lastMessageFromMe = lastMsg ? lastMsg.senderId.toString() === userIdObj.toString() : false
      const lastMessageSeen = lastMsg && lastMessageFromMe && (lastMsg.readBy || []).some((r) => r.toString() === otherId?.toString())
      // Last message theo từng user: chỉ lấy tin cuối trong số tin còn hiển thị với user này (sau khi xóa cho tôi / xóa toàn bộ cho tôi).
      const lastMessageText = lastMsg
        ? (lastMsg.content?.trim?.()?.slice(0, 200) || (lastMsg.attachments?.length ? `[${lastMsg.attachments.length} file]` : '') || '')
        : ''
      const lastMessageAtUser = lastMsg?.createdAt ?? null
      return {
        id: c._id.toString(),
        otherUserId: otherId?.toString(),
        name: other?.name || 'User',
        avatar: other?.avatar || null,
        lastMessage: lastMessageText,
        lastMessageAt: lastMessageAtUser,
        unread: unreadCount > 0,
        unreadCount,
        lastMessageFromMe,
        lastMessageSeen,
        muted: settingsMap.get(c._id.toString())?.muted ?? false,
        mutedUntil: settingsMap.get(c._id.toString())?.mutedUntil ?? null,
        disappearing: settingsMap.get(c._id.toString())?.disappearing ?? false,
        disappearingUntil: settingsMap.get(c._id.toString())?.disappearingUntil ?? null,
      }
    })
  )
  result.sort((a, b) => (new Date(b.lastMessageAt) || 0) - (new Date(a.lastMessageAt) || 0))
  return result
}

/**
 * Tổng số tin nhắn chưa đọc (chỉ tính các hội thoại chưa tắt thông báo).
 * Dùng cho badge header.
 */
export const getUnreadTotal = async (userId) => {
  const list = await getMyConversations(userId)
  const total = list.filter((c) => !c.muted).reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  return total
}

/**
 * Get bucket for user+conversation (or empty). Used to filter messages.
 */
async function getBucket(conversationId, userId) {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return { deletedUpToCreatedAt: null, deletedMessageIds: [] }
  const bucket = await MessageBucket.findOne({
    userId: userIdObj,
    conversationId: mongoose.Types.ObjectId.isValid(conversationId) ? new mongoose.Types.ObjectId(conversationId) : null,
  }).lean()
  return {
    deletedUpToCreatedAt: bucket?.deletedUpToCreatedAt ?? null,
    deletedMessageIds: (bucket?.deletedMessageIds || []).map((id) => id?.toString?.() ?? id),
  }
}

/**
 * Get messages for a conversation. Ensure user is a participant.
 * Respects bucket: excludes messages with createdAt <= deletedUpToCreatedAt or in deletedMessageIds.
 * Nếu user vừa offline >= 5p thì chạy xóa thật tin nhắn tự xóa hết hạn.
 */
export const getMessages = async (conversationId, userId) => {
  await ensureUserAccessedAndRunDisappearingCleanup(userId)
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')

  const notDeletedForEveryone = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
  const messages = await Message.find({ conversationId, ...notDeletedForEveryone }).sort({ createdAt: 1 }).lean()
  const bucket = await getBucket(conversationId, userId)
  const cutoff = bucket.deletedUpToCreatedAt ? new Date(bucket.deletedUpToCreatedAt) : null
  const deletedSet = new Set(bucket.deletedMessageIds || [])

  const visible = messages.filter((m) => {
    if (deletedSet.has(m._id.toString())) return false
    if (cutoff && m.createdAt <= cutoff) return false
    return true
  })

  return visible.map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId.toString(),
    content: m.content,
    createdAt: m.createdAt,
    readBy: (m.readBy || []).map((id) => id.toString()),
    attachments: normalizeAttachments(m),
    reactions: (m.reactions || []).map((r) => ({ userId: r.userId?.toString(), emoji: r.emoji })),
  }))
}

function normalizeAttachments(m) {
  if (Array.isArray(m.attachments) && m.attachments.length) {
    return m.attachments.map((a) => ({ url: a.url, name: a.name || null, type: a.type || null }))
  }
  if (m.attachment?.url) {
    return [{ url: m.attachment.url, name: m.attachment.name || null, type: m.attachment.type || null }]
  }
  return []
}

/**
 * Send a message in a conversation. Returns created message.
 * Caller should emit socket to other participant(s).
 */
export const sendMessage = async (conversationId, senderId, content, attachments = []) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const senderIdStr = typeof senderId === 'string' ? senderId : senderId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === senderIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')

  const text = (content || '').trim()
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  if (!text && !hasAttachments) throw new Error('MESSAGE_CONTENT_REQUIRED')

  const attachmentList = (attachments || []).map((a) => ({
    url: a.url,
    name: a.name || null,
    type: a.type || null,
  }))
  const contentText = text || (hasAttachments ? `[${attachmentList.length} file]` : '')
  const msg = await Message.create({
    conversationId,
    senderId,
    content: contentText,
    readBy: [senderId],
    attachments: attachmentList,
  })
  if (!msg) throw new Error('MESSAGE_CREATE_FAILED')

  const otherId = conv.participants.find((p) => p.toString() !== senderIdStr)?.toString() || null

  const msgObj = {
    id: msg._id.toString(),
    senderId: msg.senderId.toString(),
    content: msg.content,
    createdAt: msg.createdAt,
    readBy: (msg.readBy || []).map((id) => id.toString()),
    attachments: (msg.attachments || []).map((a) => ({ url: a.url, name: a.name, type: a.type })),
    reactions: (msg.reactions || []).map((r) => ({ userId: r.userId?.toString(), emoji: r.emoji })),
  }
  await updateUserLastAccessed(senderId)
  return { message: msgObj, otherParticipantId: otherId }
}

/**
 * Update a message (content + attachments). Chỉ cho phép khi người kia chưa xem (readBy chỉ có sender).
 * Returns updated message; caller should emit to other participant.
 */
export const updateMessage = async (conversationId, messageId, userId, content, attachments = []) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')

  const msg = await Message.findOne({ _id: messageId, conversationId }).lean()
  if (!msg) throw new Error('MESSAGE_NOT_FOUND')
  if (msg.senderId.toString() !== userIdStr) throw new Error('FORBIDDEN')
  if (msg.deletedAt) throw new Error('MESSAGE_NOT_FOUND')

  const otherId = conv.participants.find((p) => p.toString() !== userIdStr)
  const readBy = msg.readBy || []
  const otherHasRead = otherId && readBy.some((id) => id.toString() === otherId.toString())
  if (otherHasRead) throw new Error('MESSAGE_ALREADY_READ')

  const text = (content || '').trim()
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  if (!text && !hasAttachments) throw new Error('MESSAGE_CONTENT_REQUIRED')

  const attachmentList = (attachments || []).map((a) => ({
    url: a.url,
    name: a.name || null,
    type: a.type || null,
  }))
  const contentText = text || (hasAttachments ? `[${attachmentList.length} file]` : '')

  await Message.updateOne(
    { _id: messageId, conversationId },
    { $set: { content: contentText, attachments: attachmentList } }
  )

  const updated = await Message.findById(messageId).lean()
  const msgObj = {
    id: updated._id.toString(),
    senderId: updated.senderId.toString(),
    content: updated.content,
    createdAt: updated.createdAt,
    readBy: (updated.readBy || []).map((id) => id.toString()),
    attachments: (updated.attachments || []).map((a) => ({ url: a.url, name: a.name, type: a.type })),
    reactions: (updated.reactions || []).map((r) => ({ userId: r.userId?.toString(), emoji: r.emoji })),
  }
  await updateUserLastAccessed(userId)
  return { message: msgObj, otherParticipantId: otherId?.toString() || null }
}

/**
 * Mark all messages in a conversation as read for the current user.
 */
export const markConversationAsRead = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return null

  await Message.updateMany(
    { conversationId, readBy: { $nin: [userIdObj] } },
    { $addToSet: { readBy: userIdObj } }
  )
  await updateUserLastAccessed(userId)
  const otherId = conv.participants.find((p) => p.toString() !== userIdStr)?.toString() || null
  return otherId
}

const ALLOWED_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
function isValidReactionEmoji(emoji) {
  return typeof emoji === 'string' && emoji.trim() && ALLOWED_REACTION_EMOJIS.includes(emoji.trim())
}

/**
 * Toggle reaction on a message. One reaction per user (replacing previous).
 * If user already has this emoji on the message, remove it; else set it.
 */
export const reactToMessage = async (conversationId, messageId, userId, emoji) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')
  if (!isValidReactionEmoji(emoji)) throw new Error('INVALID_REACTION_EMOJI')

  const msg = await Message.findOne({ _id: messageId, conversationId }).lean()
  if (!msg) throw new Error('MESSAGE_NOT_FOUND')

  const reactions = (msg.reactions || []).map((r) => ({ userId: r.userId?.toString(), emoji: r.emoji }))
  const existingIndex = reactions.findIndex((r) => r.userId === userIdStr)
  const trimmedEmoji = emoji.trim()
  const hasSame = existingIndex >= 0 && reactions[existingIndex].emoji === trimmedEmoji

  let nextReactions
  if (hasSame) {
    nextReactions = reactions.filter((_, i) => i !== existingIndex)
  } else {
    const withoutMe = reactions.filter((r) => r.userId !== userIdStr)
    nextReactions = [...withoutMe, { userId: userIdStr, emoji: trimmedEmoji }]
  }

  await Message.updateOne(
    { _id: messageId, conversationId },
    { $set: { reactions: nextReactions.map((r) => ({ userId: new mongoose.Types.ObjectId(r.userId), emoji: r.emoji })) } }
  )

  const otherId = conv.participants.find((p) => p.toString() !== userIdStr)?.toString() || null
  return { message: { id: messageId, reactions: nextReactions }, otherParticipantId: otherId }
}

const FAR_FUTURE_MS = 10 * 365 * 24 * 60 * 60 * 1000 // ~10 years

/** Cập nhật lastAccessedAt cho user (gọi khi có request conversation). */
export const updateUserLastAccessed = async (userId) => {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return
  await User.updateOne({ _id: userIdObj }, { $set: { lastAccessedAt: new Date() } })
}

/**
 * Xóa thật tin nhắn đã hết hạn trong các conversation có bật disappearing (chỉ chạy khi user vừa offline >= 5p).
 */
async function runDisappearingCleanupForUser(userId) {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return
  const now = new Date()
  const settings = await ConversationSetting.find({
    userId: userIdObj,
    disappearingUntil: { $gt: now },
    disappearingDurationSeconds: { $exists: true, $ne: null, $gt: 0 },
  }).lean()
  for (const s of settings) {
    const cutoff = new Date(now.getTime() - (s.disappearingDurationSeconds || 0) * 1000)
    await Message.deleteMany({
      conversationId: s.conversationId,
      createdAt: { $lt: cutoff },
    })
  }
}

/**
 * Chạy cleanup tin nhắn tự xóa (xóa tin cũ hơn duration) mỗi khi user load conversations/messages;
 * sau đó cập nhật lastAccessedAt.
 * Trước đây chỉ chạy khi offline >= 5p nên tin gần như không bao giờ bị xóa nếu user luôn mở app.
 */
export const ensureUserAccessedAndRunDisappearingCleanup = async (userId) => {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return
  await runDisappearingCleanupForUser(userId)
  await updateUserLastAccessed(userId)
}

/**
 * Update conversation settings (mute / disappearing messages) by time. Same model for both.
 * disappearingDurationSeconds: 3600 (1h), 28800 (8h), 86400 (24h) - tin cũ hơn sẽ bị xóa thật khi user offline 5p.
 */
export const updateSettings = async (conversationId, userId, { mutedUntil, disappearingUntil, disappearingDurationSeconds }) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === userIdObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')

  const update = {}
  if (mutedUntil !== undefined) {
    update.mutedUntil = mutedUntil == null ? null : new Date(mutedUntil)
  }
  if (disappearingUntil !== undefined) {
    update.disappearingUntil = disappearingUntil == null ? null : new Date(disappearingUntil)
    if (disappearingUntil == null || disappearingUntil === '') {
      update.disappearingDurationSeconds = null
    }
  }
  if (disappearingDurationSeconds !== undefined) {
    update.disappearingDurationSeconds = disappearingDurationSeconds == null || disappearingDurationSeconds === '' ? null : Number(disappearingDurationSeconds)
  }
  if (Object.keys(update).length === 0) {
    const existing = await ConversationSetting.findOne({ userId: userIdObj, conversationId: conv._id }).lean()
    const now = new Date()
    return {
      muted: !!(existing?.mutedUntil && new Date(existing.mutedUntil) > now),
      mutedUntil: existing?.mutedUntil ?? null,
      disappearing: !!(existing?.disappearingUntil && new Date(existing.disappearingUntil) > now),
      disappearingUntil: existing?.disappearingUntil ?? null,
      disappearingDurationSeconds: existing?.disappearingDurationSeconds ?? null,
    }
  }

  const doc = await ConversationSetting.findOneAndUpdate(
    { userId: userIdObj, conversationId: conv._id },
    { $set: update },
    { upsert: true, new: true }
  ).lean()

  const now = new Date()
  return {
    muted: !!(doc.mutedUntil && new Date(doc.mutedUntil) > now),
    mutedUntil: doc.mutedUntil ?? null,
    disappearing: !!(doc.disappearingUntil && new Date(doc.disappearingUntil) > now),
    disappearingUntil: doc.disappearingUntil ?? null,
    disappearingDurationSeconds: doc.disappearingDurationSeconds ?? null,
  }
}

/**
 * Single delete for me: add messageId to bucket.deletedMessageIds (same for own or others' messages).
 * "Xóa với tôi" chỉ dùng MessageBucket, không ghi vào Message.
 */
export const deleteMessageForMe = async (conversationId, messageId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === userIdObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')

  const msg = await Message.findOne({ _id: messageId, conversationId: conv._id }).lean()
  if (!msg) throw new Error('MESSAGE_NOT_FOUND')

  const messageIdObj = mongoose.Types.ObjectId.isValid(messageId) ? new mongoose.Types.ObjectId(messageId) : null
  if (!messageIdObj) return { deleted: true }

  await MessageBucket.findOneAndUpdate(
    { userId: userIdObj, conversationId: conv._id },
    { $addToSet: { deletedMessageIds: messageIdObj } },
    { upsert: true, new: true }
  )
  return { deleted: true }
}

/**
 * Delete all for me: set bucket.deletedUpToCreatedAt to the last message's createdAt in this conversation.
 */
export const deleteAllMessagesForMe = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === userIdObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')

  const lastMsg = await Message.findOne(
    { conversationId: conv._id, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
  )
    .sort({ createdAt: -1 })
    .lean()
  const deletedUpToCreatedAt = lastMsg ? lastMsg.createdAt : new Date()

  await MessageBucket.findOneAndUpdate(
    { userId: userIdObj, conversationId: conv._id },
    { $set: { deletedUpToCreatedAt } },
    { upsert: true, new: true }
  )
  return { deleted: true, deletedUpToCreatedAt }
}

/**
 * Xóa mềm tin nhắn cho cả hai (chỉ người gửi): set deletedAt.
 */
export const deleteMessageForEveryone = async (conversationId, messageId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')

  const msg = await Message.findOne({ _id: messageId, conversationId: conv._id }).lean()
  if (!msg) throw new Error('MESSAGE_NOT_FOUND')
  if (msg.senderId.toString() !== userIdStr) throw new Error('FORBIDDEN')

  await Message.updateOne(
    { _id: messageId, conversationId: conv._id },
    { $set: { deletedAt: new Date() } }
  )
  const otherId = conv.participants.find((p) => p.toString() !== userIdStr)?.toString() || null
  return { deleted: true, otherParticipantId: otherId }
}
