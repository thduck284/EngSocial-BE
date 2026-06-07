import mongoose from 'mongoose'
import { isUserOnline } from '../config/socket.js'
import { Conversation, MessageBucket, ConversationSetting, Message, User } from '../models/index.js'
import { bumpPeriodicQuestsOnOnlineTimeEvent } from './userPeriodicQuest.service.js'
import { incrementChallengeProgressByRequirement } from './challenge.service.js'
import { getBlockSets, isHiddenUser, hiddenUserObjectIds } from '../utils/blockFilter.js'

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

  const other = await User.findById(otherId).select('name avatar lastActiveDate blockedUserIds').lean()
  if (!other) throw new Error('USER_NOT_FOUND')
  const otherIdStr = otherId.toString()

  const { hiddenIds } = await getBlockSets(myId)
  if (hiddenIds.has(otherIdStr)) throw new Error('USER_BLOCKED')

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
    lastActiveDate: other.lastActiveDate ?? null,
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
    online: isUserOnline(otherIdStr),
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

const GROUP_MAX_MEMBERS_DEFAULT = 50

/**
 * Tạo hội thoại nhóm. participantIds = danh sách userId (bạn bè), không bao gồm chính mình.
 * Role: người tạo = host, thành viên thêm = user.
 * @returns { conversationId, name, avatar, participants, participantRoles }
 */
export const createGroupConversation = async (myId, { name, avatar, participantIds }) => {
  const myIdObj = mongoose.Types.ObjectId.isValid(myId) ? new mongoose.Types.ObjectId(myId) : null
  if (!myIdObj) throw new Error('FORBIDDEN')
  const raw = (participantIds && Array.isArray(participantIds) ? participantIds : [])
    .filter(Boolean)
    .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null))
    .filter(Boolean)
  const unique = [...new Set([myIdObj.toString(), ...raw.map((id) => id.toString())])]
  const participants = unique.map((id) => new mongoose.Types.ObjectId(id))
  const displayName = (name && String(name).trim()) || 'Nhóm chat'
  if (participants.length < 3) throw new Error('GROUP_NEED_AT_LEAST_TWO_MEMBERS')

  const maxMembers = Math.min(Math.max(2, GROUP_MAX_MEMBERS_DEFAULT), 256)
  if (participants.length > maxMembers) throw new Error('GROUP_EXCEED_MAX_MEMBERS')

  const participantRoles = [
    { userId: myIdObj, role: 'host' },
    ...participants
      .filter((p) => !p.equals(myIdObj))
      .map((p) => ({ userId: p, role: 'user' })),
  ]
  const created = await Conversation.create({
    type: 'group',
    name: displayName,
    avatar: (avatar && String(avatar).trim()) || '',
    maxMembers,
    participants,
    participantRoles,
  })

  const otherParticipantIds = participants.filter((p) => !p.equals(myIdObj))
  const users = await User.find({ _id: { $in: [myIdObj, ...otherParticipantIds] } }).select('name').lean()
  const creator = users.find((u) => u._id.toString() === myIdObj.toString())
  const creatorName = creator?.name?.trim() || 'Thành viên'
  const otherNames = users
    .filter((u) => u._id.toString() !== myIdObj.toString())
    .map((u) => (u?.name || 'User').trim())
  let systemContent
  if (otherNames.length <= 3) {
    systemContent = `${creatorName} đã thêm ${otherNames.join(', ')} vào nhóm.`
  } else {
    systemContent = `${creatorName} đã thêm ${otherNames.slice(0, 3).join(', ')}, ... xem thêm vào nhóm.`
  }

  await Message.create({
    conversationId: created._id,
    senderId: myIdObj,
    content: systemContent,
    messageType: 'system',
    readBy: participants,
  })

  return {
    conversationId: created._id.toString(),
    name: created.name,
    avatar: created.avatar || null,
    participants: participants.map((p) => p.toString()),
    participantRoles: participantRoles.map((r) => ({ userId: r.userId.toString(), role: r.role })),
  }
}

/**
 * Get list of conversations for current user (with last message and other participant for direct).
 * Bao gồm cả direct và group.
 */
export const getMyConversations = async (userId, options = {}) => {
  await ensureUserAccessedAndRunDisappearingCleanup(userId)
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return options.forForward ? { data: [], total: 0, hasMore: false } : []
  const list = await Conversation.find({ participants: userIdObj }).lean()

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

  let blockedSet = new Set()
  const { hiddenIds } = await getBlockSets(userId)
  const me = await User.findById(userIdObj).select('blockedUserIds').lean()
  if (me?.blockedUserIds?.length) {
    blockedSet = new Set(me.blockedUserIds.map((b) => b.toString()))
  }

  const result = await Promise.all(
    list.map(async (c) => {
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
      const lastMessageText = lastMsg
        ? (lastMsg.content?.trim?.()?.slice(0, 200) || (lastMsg.attachments?.length ? `[${lastMsg.attachments.length} file]` : '') || '')
        : ''
      const lastMessageAtUser = lastMsg?.createdAt ?? null

      if (c.type === 'group') {
        const allParticipantIds = (c.participants || []).map((p) => p.toString())
        const otherParticipantIds = allParticipantIds.filter((id) => id !== userIdObj.toString())
        const others = await User.find({ _id: { $in: c.participants } }).select('name avatar lastActiveDate').lean()
        const visibleOthers = others.filter((u) => !isHiddenUser(u._id, hiddenIds))
        const participantNames = visibleOthers.map((u) => u?.name || 'User').slice(0, 3)
        const lastActiveDates = visibleOthers.map((u) => u?.lastActiveDate).filter(Boolean)
        const groupLastActiveDate = lastActiveDates.length ? new Date(Math.max(...lastActiveDates.map((d) => new Date(d).getTime()))) : null
        const roles = (c.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
        const myRoleEntry = roles.find((r) => r.userId === userIdObj.toString())
        const myRole = myRoleEntry?.role || 'user'
        const roleOrder = { host: 0, admin: 1, user: 2 }
        const members = visibleOthers
          .map((u) => {
            const uid = u._id.toString()
            const roleEntry = roles.find((r) => r.userId === uid)
            return { userId: uid, name: u?.name || 'User', avatar: u?.avatar || null, role: roleEntry?.role || 'user' }
          })
          .sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3))
        const groupPermissions = c.groupPermissions
          ? {
              adminCanKick: !!c.groupPermissions.adminCanKick,
              adminCanAddMembers: !!c.groupPermissions.adminCanAddMembers,
              adminCanEditGroupInfo: !!c.groupPermissions.adminCanEditGroupInfo,
              adminCanAssignUserPermissions: !!c.groupPermissions.adminCanAssignUserPermissions,
              adminCanBlockUser: c.groupPermissions.adminCanBlockUser !== false,
              userCanAddMembers: !!c.groupPermissions.userCanAddMembers,
              userCanEditGroupInfo: !!c.groupPermissions.userCanEditGroupInfo,
            }
          : {
              adminCanKick: true,
              adminCanAddMembers: true,
              adminCanEditGroupInfo: false,
              adminCanAssignUserPermissions: false,
              adminCanBlockUser: true,
              userCanAddMembers: false,
              userCanEditGroupInfo: false,
            }
        const blockedIds = (c.blockedUserIds || []).map((b) => b.toString?.() ?? b)
        const blockedUsers = blockedIds.length > 0 ? await User.find({ _id: { $in: c.blockedUserIds } }).select('name avatar').lean() : []
        const blockedMembers = blockedUsers.map((u) => ({ userId: u._id.toString(), name: u?.name || 'User', avatar: u?.avatar || null }))
        const hasOnlineMember = otherParticipantIds.some((id) => !hiddenIds.has(id) && isUserOnline(id))
        return {
          id: c._id.toString(),
          otherUserId: null,
          name: (c.name && c.name.trim()) || participantNames.join(', ') || 'Nhóm',
          avatar: (c.avatar && c.avatar.trim()) || null,
          isGroup: true,
          myRole,
          participantRoles: roles,
          members,
          blockedMembers,
          maxMembers: c.maxMembers ?? GROUP_MAX_MEMBERS_DEFAULT,
          memberCount: visibleOthers.length,
          groupPermissions,
          lastMessage: lastMessageText,
          lastMessageAt: lastMessageAtUser,
          unread: unreadCount > 0,
          unreadCount,
          lastMessageFromMe,
          lastMessageSeen: false,
          muted: settingsMap.get(c._id.toString())?.muted ?? false,
          mutedUntil: settingsMap.get(c._id.toString())?.mutedUntil ?? null,
          disappearing: settingsMap.get(c._id.toString())?.disappearing ?? false,
          disappearingUntil: settingsMap.get(c._id.toString())?.disappearingUntil ?? null,
          online: hasOnlineMember,
          lastActiveDate: groupLastActiveDate,
        }
      }

      const otherId = c.participants.find((p) => p.toString() !== userIdObj.toString())
      const otherIdStr = otherId?.toString()
      const other = await User.findById(otherId).select('name avatar lastActiveDate blockedUserIds').lean()
      const theyBlockedMe = (other?.blockedUserIds || []).some((b) => b.toString() === userIdObj.toString())
      const lastMessageSeen = lastMsg && lastMessageFromMe && (lastMsg.readBy || []).some((r) => r.toString() === otherId?.toString())
      return {
        id: c._id.toString(),
        otherUserId: otherIdStr,
        name: other?.name || 'User',
        avatar: other?.avatar || null,
        isGroup: false,
        iBlockedThem: blockedSet.has(otherIdStr),
        theyBlockedMe,
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
        online: isUserOnline(otherIdStr),
        lastActiveDate: other?.lastActiveDate ?? null,
      }
    })
  )
  result.sort((a, b) => (new Date(b.lastMessageAt) || 0) - (new Date(a.lastMessageAt) || 0))
  const q = (options.q || '').trim().toLowerCase()
  if (q) {
    const filtered = result.filter((c) => (c.name || '').toLowerCase().includes(q))
    if (options.forForward) {
      return { data: filtered, total: filtered.length, hasMore: false }
    }
    return filtered
  }
  if (options.forForward) {
    const withMessages = result.filter((c) => c.lastMessageAt != null)
    const total = withMessages.length
    const offset = Math.max(0, parseInt(options.offset, 10) || 0)
    const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 5))
    const data = withMessages.slice(offset, offset + limit)
    return { data, total, hasMore: offset + data.length < total }
  }
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

const DEFAULT_MESSAGES_LIMIT = 10

/**
 * Get messages for a conversation with pagination. Ensure user is a participant.
 * Respects bucket: excludes messages with createdAt <= deletedUpToCreatedAt or in deletedMessageIds.
 * @param {string} conversationId
 * @param {string} userId
 * @param {{ limit?: number, before?: string }} [opts] - limit (default 10), before = messageId cursor (load older than this)
 * @returns messages in chronological order (oldest first). If no `before`, returns latest `limit` messages. If `before`, returns up to `limit` messages older than that message.
 */
export const getMessages = async (conversationId, userId, opts = {}) => {
  await ensureUserAccessedAndRunDisappearingCleanup(userId)
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  const userIdStr = typeof userId === 'string' ? userId : userId?.toString?.()
  const isParticipant = conv.participants.some((p) => p.toString() === userIdStr)
  if (!isParticipant) throw new Error('FORBIDDEN')

  const limit = Math.min(Math.max(1, opts.limit || DEFAULT_MESSAGES_LIMIT), 50)
  const beforeId = opts.before || null

  const bucket = await getBucket(conversationId, userId)
  const cutoff = bucket.deletedUpToCreatedAt ? new Date(bucket.deletedUpToCreatedAt) : null
  const deletedIds = (bucket.deletedMessageIds || []).filter(Boolean).map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id))

  const { hiddenIds } = await getBlockSets(userId)
  const excludeSenderIds = conv.type === 'group' ? hiddenUserObjectIds(hiddenIds) : []

  const notDeletedForEveryone = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
  const baseFilter = {
    conversationId,
    ...notDeletedForEveryone,
    ...(deletedIds.length > 0 && { _id: { $nin: deletedIds } }),
    ...(cutoff && { createdAt: { $gt: cutoff } }),
    ...(excludeSenderIds.length > 0 && { senderId: { $nin: excludeSenderIds } }),
  }

  let query = Message.find(baseFilter)
  if (beforeId && mongoose.Types.ObjectId.isValid(beforeId)) {
    const beforeDoc = await Message.findOne({ _id: beforeId, conversationId }).select('createdAt').lean()
    if (beforeDoc) query = query.where('createdAt').lt(beforeDoc.createdAt)
  }
  const messages = await query.sort({ createdAt: -1 }).limit(limit).lean()
  const chronological = messages.reverse()

  return chronological.map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId.toString(),
    content: m.content,
    createdAt: m.createdAt,
    messageType: m.messageType || 'user',
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
  if (conv.type === 'direct') {
    const otherId = conv.participants.find((p) => p.toString() !== senderIdStr)?.toString()
    if (otherId) {
      const { hiddenIds } = await getBlockSets(senderId)
      if (hiddenIds.has(otherId)) throw new Error('BLOCKED_BY_ME')
    }
  }

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

  const otherParticipantIds = conv.participants
    .filter((p) => p.toString() !== senderIdStr)
    .map((p) => p.toString())
  const otherParticipantId = conv.type === 'direct' ? otherParticipantIds[0] || null : null

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
  return { message: msgObj, otherParticipantId, otherParticipantIds }
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
  const otherParticipantIds = conv.participants
    .filter((p) => p.toString() !== userIdStr)
    .map((p) => p.toString())
  return { message: msgObj, otherParticipantId: otherParticipantIds[0] || null, otherParticipantIds }
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
  if (!userIdObj) return { otherParticipantIds: [] }

  await Message.updateMany(
    { conversationId, readBy: { $nin: [userIdObj] } },
    { $addToSet: { readBy: userIdObj } }
  )
  await updateUserLastAccessed(userId)
  const otherParticipantIds = conv.participants
    .filter((p) => p.toString() !== userIdStr)
    .map((p) => p.toString())
  return { otherParticipantIds }
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

  const otherParticipantIds = conv.participants
    .filter((p) => p.toString() !== userIdStr)
    .map((p) => p.toString())
  return { message: { id: messageId, reactions: nextReactions }, otherParticipantId: otherParticipantIds[0] || null, otherParticipantIds }
}

const FAR_FUTURE_MS = 10 * 365 * 24 * 60 * 60 * 1000 // ~10 years
const ONLINE_TIME_BUMP_INTERVAL_MS = 60 * 1000 // 1 minute
const lastOnlineQuestBumpByUser = new Map()

/** Cập nhật lastAccessedAt và lastActiveDate cho user (gọi khi có request conversation). lastActiveDate dùng để hiển thị "Hoạt động x phút trước". */
export const updateUserLastAccessed = async (userId) => {
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) return
  const now = new Date()
  const uid = userIdObj.toString()
  const nowMs = now.getTime()
  const lastMs = lastOnlineQuestBumpByUser.get(uid) || 0
  const shouldBump = nowMs - lastMs >= ONLINE_TIME_BUMP_INTERVAL_MS
  const update = { $set: { lastAccessedAt: now, lastActiveDate: now } }
  if (shouldBump) {
    lastOnlineQuestBumpByUser.set(uid, nowMs)
    update.$inc = { 'achievementStats.onlineMinutes': 1 }
    try {
      await bumpPeriodicQuestsOnOnlineTimeEvent(uid, 1)
    } catch (e) {
      console.warn('[periodicQuest] online time bump:', e?.message)
    }
    try {
      await incrementChallengeProgressByRequirement(uid, 'time', 1)
    } catch (e) {
      console.warn('[challenge] online time bump:', e?.message)
    }
  }
  await User.updateOne({ _id: userIdObj }, update)
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
 * Cập nhật thông tin nhóm (name, avatar, maxMembers, groupPermissions).
 * Chỉ host mới được đổi maxMembers và groupPermissions.
 * Host hoặc admin (nếu adminCanEditGroupInfo) được đổi name, avatar.
 */
export const updateGroupSettings = async (conversationId, userId, payload) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === userIdObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')

  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === userIdObj.toString())?.role || 'user'
  const currentPerms = conv.groupPermissions || {}
  const canEditNameAvatar = myRole === 'host' || (myRole === 'admin' && currentPerms.adminCanEditGroupInfo) || (myRole === 'user' && currentPerms.userCanEditGroupInfo)
  const canEditMaxMembers = myRole === 'host'
  const canEditPermissionsOrMax = myRole === 'host'
  const canEditUserPermissionsOnly = myRole === 'admin' && currentPerms.adminCanAssignUserPermissions

  const update = {}
  if (payload.name !== undefined && canEditNameAvatar) {
    update.name = typeof payload.name === 'string' ? payload.name.trim() : ''
  }
  if (payload.avatar !== undefined && canEditNameAvatar) {
    update.avatar = payload.avatar == null || payload.avatar === '' ? '' : String(payload.avatar).trim()
  }
  if (payload.maxMembers !== undefined && (canEditPermissionsOrMax || canEditMaxMembers)) {
    const val = Math.floor(Number(payload.maxMembers))
    if (!Number.isNaN(val) && val >= 2 && val <= GROUP_MAX_MEMBERS_DEFAULT) {
      const currentCount = (conv.participants || []).length
      if (val >= currentCount) {
        update.maxMembers = val
      }
    }
  }
  if (payload.groupPermissions !== undefined && typeof payload.groupPermissions === 'object') {
    const p = payload.groupPermissions
    if (canEditPermissionsOrMax) {
      update.groupPermissions = {
        adminCanKick: p.adminCanKick === true,
        adminCanAddMembers: p.adminCanAddMembers === true,
        adminCanEditGroupInfo: p.adminCanEditGroupInfo === true,
        adminCanAssignUserPermissions: p.adminCanAssignUserPermissions === true,
        adminCanBlockUser: p.adminCanBlockUser !== false,
        userCanAddMembers: p.userCanAddMembers === true,
        userCanEditGroupInfo: p.userCanEditGroupInfo === true,
      }
    } else if (canEditUserPermissionsOnly) {
      const existing = conv.groupPermissions || {}
      update.groupPermissions = {
        adminCanKick: existing.adminCanKick === true,
        adminCanAddMembers: existing.adminCanAddMembers === true,
        adminCanEditGroupInfo: existing.adminCanEditGroupInfo === true,
        adminCanAssignUserPermissions: existing.adminCanAssignUserPermissions === true,
        adminCanBlockUser: existing.adminCanBlockUser !== false,
        userCanAddMembers: p.userCanAddMembers === true,
        userCanEditGroupInfo: p.userCanEditGroupInfo === true,
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return conv
  }
  const updated = await Conversation.findByIdAndUpdate(conversationId, { $set: update }, { new: true }).lean()
  return updated
}

/**
 * Thêm thành viên vào nhóm. Chỉ host hoặc admin (có adminCanAddMembers) mới được gọi.
 * @param {string} conversationId
 * @param {string[]} userIds - danh sách userId cần thêm (bạn bè, không trùng thành viên hiện tại, không nằm trong blockedUserIds)
 * @returns { conversationId, addedCount, addedUserIds }
 */
export const addMembersToGroup = async (conversationId, userIds, requestedByUserId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const requestedByObj = mongoose.Types.ObjectId.isValid(requestedByUserId) ? new mongoose.Types.ObjectId(requestedByUserId) : null
  if (!requestedByObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === requestedByObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')
  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === requestedByObj.toString())?.role || 'user'
  const perms = conv.groupPermissions || {}
  const canAdd = myRole === 'host' || (myRole === 'admin' && perms.adminCanAddMembers)
  if (!canAdd) throw new Error('FORBIDDEN')

  const currentParticipantIds = new Set((conv.participants || []).map((p) => p.toString()))
  const maxMembers = conv.maxMembers ?? GROUP_MAX_MEMBERS_DEFAULT
  const toAdd = (Array.isArray(userIds) ? userIds : [])
    .map((id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null))
    .filter((id) => id && !currentParticipantIds.has(id.toString()))
  const uniqueToAdd = [...new Set(toAdd.map((id) => id.toString()))].map((id) => new mongoose.Types.ObjectId(id))
  if (uniqueToAdd.length === 0) throw new Error('NO_VALID_MEMBERS_TO_ADD')
  if (currentParticipantIds.size + uniqueToAdd.length > maxMembers) {
    throw new Error('GROUP_EXCEED_MAX_MEMBERS')
  }

  const newParticipants = [...conv.participants, ...uniqueToAdd]
  const newRoles = [...(conv.participantRoles || [])]
  uniqueToAdd.forEach((uid) => {
    if (!newRoles.some((r) => r.userId.toString() === uid.toString())) {
      newRoles.push({ userId: uid, role: 'user' })
    }
  })
  const addedIdsSet = new Set(uniqueToAdd.map((id) => id.toString()))
  const newBlockedUserIds = (conv.blockedUserIds || []).filter((b) => !addedIdsSet.has(b.toString()))

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      participants: newParticipants,
      participantRoles: newRoles,
      blockedUserIds: newBlockedUserIds,
    },
  })
  const addedUserIds = uniqueToAdd.map((id) => id.toString())

  const users = await User.find({ _id: { $in: [requestedByObj, ...uniqueToAdd] } })
    .select('name')
    .lean()
  const requester = users.find((u) => u._id.toString() === requestedByObj.toString())
  const requesterName = (requester?.name || '').trim() || 'Thành viên'
  const addedNames = uniqueToAdd
    .map((uid) => {
      const u = users.find((x) => x._id.toString() === uid.toString())
      return (u?.name || 'User').trim()
    })
    .filter(Boolean)
  let systemContent
  if (addedNames.length <= 3) {
    systemContent = `${requesterName} đã thêm ${addedNames.join(', ')} vào nhóm.`
  } else {
    systemContent = `${requesterName} đã thêm ${addedNames.slice(0, 3).join(', ')}, ... xem thêm vào nhóm.`
  }

  const systemMsgDoc = await Message.create({
    conversationId: conv._id,
    senderId: requestedByObj,
    content: systemContent,
    messageType: 'system',
    readBy: newParticipants,
  })
  const systemMessage = {
    id: systemMsgDoc._id.toString(),
    senderId: systemMsgDoc.senderId.toString(),
    content: systemMsgDoc.content,
    messageType: 'system',
    createdAt: systemMsgDoc.createdAt,
    readBy: (systemMsgDoc.readBy || []).map((id) => id.toString()),
    attachments: [],
    reactions: [],
  }

  const participantIds = newParticipants.map((p) => p.toString())
  return {
    conversationId,
    addedCount: addedUserIds.length,
    addedUserIds,
    participantIds,
    systemMessage,
  }
}

/**
 * Đặt role thành viên trong nhóm (admin | user). Chỉ host mới được gọi.
 * Không được đổi role của host.
 * @returns { conversationId, userId, role }
 */
export const setMemberRoleInGroup = async (conversationId, targetUserId, role, requestedByUserId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const requestedByObj = mongoose.Types.ObjectId.isValid(requestedByUserId) ? new mongoose.Types.ObjectId(requestedByUserId) : null
  const targetObj = mongoose.Types.ObjectId.isValid(targetUserId) ? new mongoose.Types.ObjectId(targetUserId) : null
  if (!requestedByObj || !targetObj) throw new Error('FORBIDDEN')
  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === requestedByObj.toString())?.role || 'user'
  if (myRole !== 'host') throw new Error('FORBIDDEN')
  const targetInParticipants = conv.participants.some((p) => p.toString() === targetObj.toString())
  if (!targetInParticipants) throw new Error('USER_NOT_IN_GROUP')
  const newRole = role === 'admin' ? 'admin' : 'user'
  const hostEntry = (conv.participantRoles || []).find((r) => r.role === 'host')
  if (hostEntry && hostEntry.userId.toString() === targetObj.toString()) throw new Error('CANNOT_CHANGE_HOST_ROLE')

  const newRoles = (conv.participantRoles || []).map((r) => {
    if (r.userId.toString() !== targetObj.toString()) return r
    return { userId: r.userId, role: newRole }
  })

  await Conversation.findByIdAndUpdate(conversationId, { $set: { participantRoles: newRoles } })
  const participantIds = (conv.participants || []).map((p) => p.toString())

  const users = await User.find({ _id: { $in: [requestedByObj, targetObj] } }).select('name').lean()
  const hostName = (users.find((u) => u._id.toString() === requestedByObj.toString())?.name || '').trim() || 'Chủ nhóm'
  const targetName = (users.find((u) => u._id.toString() === targetObj.toString())?.name || '').trim() || 'Thành viên'
  const systemContent =
    newRole === 'admin'
      ? `${hostName} đã đặt ${targetName} làm quản trị viên.`
      : `${hostName} đã gỡ quyền quản trị viên của ${targetName}.`

  const systemMsgDoc = await Message.create({
    conversationId: conv._id,
    senderId: requestedByObj,
    content: systemContent,
    messageType: 'system',
    readBy: conv.participants,
  })
  const systemMessage = {
    id: systemMsgDoc._id.toString(),
    senderId: systemMsgDoc.senderId.toString(),
    content: systemMsgDoc.content,
    messageType: 'system',
    createdAt: systemMsgDoc.createdAt,
    readBy: (systemMsgDoc.readBy || []).map((id) => id.toString()),
    attachments: [],
    reactions: [],
  }

  return { conversationId, userId: targetUserId, role: newRole, participantIds, systemMessage }
}

/**
 * Chặn thành viên khỏi nhóm: xóa khỏi participants và participantRoles, thêm vào blockedUserIds.
 * Chỉ host hoặc admin (có adminCanBlockUser hoặc adminCanKick) mới được gọi.
 */
export const blockUserInGroup = async (conversationId, targetUserId, requestedByUserId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const requestedByObj = mongoose.Types.ObjectId.isValid(requestedByUserId) ? new mongoose.Types.ObjectId(requestedByUserId) : null
  const targetObj = mongoose.Types.ObjectId.isValid(targetUserId) ? new mongoose.Types.ObjectId(targetUserId) : null
  if (!requestedByObj || !targetObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === requestedByObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')
  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === requestedByObj.toString())?.role || 'user'
  const perms = conv.groupPermissions || {}
  const canBlock = myRole === 'host' || (myRole === 'admin' && perms.adminCanBlockUser !== false)
  if (!canBlock) throw new Error('FORBIDDEN')
  const targetInParticipants = conv.participants.some((p) => p.toString() === targetObj.toString())
  if (!targetInParticipants) throw new Error('USER_NOT_IN_GROUP')
  const hostEntry = (conv.participantRoles || []).find((r) => r.role === 'host')
  if (hostEntry && hostEntry.userId.toString() === targetObj.toString()) throw new Error('CANNOT_BLOCK_HOST')

  const newParticipants = conv.participants.filter((p) => !p.equals(targetObj))
  const newRoles = (conv.participantRoles || []).filter((r) => !r.userId.equals(targetObj))
  const blockedList = (conv.blockedUserIds || []).slice()
  if (!blockedList.some((b) => b.toString() === targetObj.toString())) blockedList.push(targetObj)

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      participants: newParticipants,
      participantRoles: newRoles,
      blockedUserIds: blockedList,
    },
  })
  return { conversationId, blockedUserId: targetUserId }
}

/**
 * Bỏ chặn thành viên: xóa khỏi blockedUserIds (không tự thêm lại vào nhóm).
 * Chỉ host hoặc admin (có adminCanBlockUser hoặc adminCanKick) mới được gọi.
 */
export const unblockUserInGroup = async (conversationId, targetUserId, requestedByUserId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const requestedByObj = mongoose.Types.ObjectId.isValid(requestedByUserId) ? new mongoose.Types.ObjectId(requestedByUserId) : null
  const targetObj = mongoose.Types.ObjectId.isValid(targetUserId) ? new mongoose.Types.ObjectId(targetUserId) : null
  if (!requestedByObj || !targetObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === requestedByObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')
  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === requestedByObj.toString())?.role || 'user'
  const perms = conv.groupPermissions || {}
  const canUnblock = myRole === 'host' || (myRole === 'admin' && perms.adminCanBlockUser !== false)
  if (!canUnblock) throw new Error('FORBIDDEN')

  const blockedList = (conv.blockedUserIds || []).filter((b) => b.toString() !== targetObj.toString())
  await Conversation.findByIdAndUpdate(conversationId, { $set: { blockedUserIds: blockedList } })
  const participantIds = (conv.participants || []).map((p) => p.toString())
  return { conversationId, unblockedUserId: targetUserId, participantIds }
}

/**
 * Giải tán nhóm: chỉ host mới được gọi. Xóa conversation (nhóm sẽ biến mất khỏi danh sách của tất cả thành viên).
 * @returns { conversationId, participantIds } để emit socket cho từng user.
 */
export const disbandGroup = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const roles = (conv.participantRoles || []).map((r) => ({ userId: r.userId?.toString(), role: r.role || 'user' }))
  const myRole = roles.find((r) => r.userId === userIdObj.toString())?.role || 'user'
  if (myRole !== 'host') throw new Error('FORBIDDEN')

  const participantIds = (conv.participants || []).map((p) => p.toString())
  await Conversation.findByIdAndDelete(conversationId)
  return { conversationId, participantIds }
}

/**
 * Rời nhóm: mọi thành viên đều được gọi. Xóa user khỏi participants và participantRoles.
 * Nếu user là host thì chuyển quyền host cho admin đầu tiên hoặc thành viên đầu tiên.
 * Nếu không còn ai thì xóa conversation (giải tán).
 * @returns { conversationId, leftUserId, participantIds?, disbanded? }
 */
export const leaveGroup = async (conversationId, userId) => {
  const conv = await Conversation.findById(conversationId).lean()
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
  if (conv.type !== 'group') throw new Error('FORBIDDEN')
  const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
  if (!userIdObj) throw new Error('FORBIDDEN')
  const isParticipant = conv.participants.some((p) => p.toString() === userIdObj.toString())
  if (!isParticipant) throw new Error('FORBIDDEN')

  const newParticipants = conv.participants.filter((p) => !p.equals(userIdObj))
  let newRoles = (conv.participantRoles || []).filter((r) => !r.userId.equals(userIdObj))
  const wasHost = (conv.participantRoles || []).some((r) => r.userId.equals(userIdObj) && r.role === 'host')

  if (newParticipants.length === 0) {
    await Conversation.findByIdAndDelete(conversationId)
    return { conversationId, leftUserId: userId, disbanded: true, participantIds: [] }
  }

  if (wasHost) {
    const nextHost = newRoles.find((r) => r.role === 'admin') || newRoles[0]
    if (nextHost) {
      const nextHostIdStr = nextHost.userId?.toString?.() || nextHost.userId
      newRoles = newRoles.map((r) => ({
        userId: r.userId,
        role: (r.userId?.toString?.() || r.userId) === nextHostIdStr ? 'host' : r.role,
      }))
    }
  }

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: { participants: newParticipants, participantRoles: newRoles },
  })
  const participantIds = newParticipants.map((p) => p.toString())

  const leftUser = await User.findById(userIdObj).select('name').lean()
  const leftUserName = (leftUser?.name || '').trim() || 'Thành viên'
  const systemContent = `${leftUserName} đã rời khỏi nhóm`
  const systemMsgDoc = await Message.create({
    conversationId: conv._id,
    senderId: userIdObj,
    content: systemContent,
    messageType: 'system',
    readBy: newParticipants,
  })

  const systemMessage = {
    id: systemMsgDoc._id.toString(),
    senderId: systemMsgDoc.senderId.toString(),
    content: systemMsgDoc.content,
    messageType: 'system',
    createdAt: systemMsgDoc.createdAt,
    readBy: (systemMsgDoc.readBy || []).map((id) => id.toString()),
    attachments: [],
    reactions: [],
  }

  return {
    conversationId,
    leftUserId: userId,
    leftUserName,
    participantIds,
    systemMessage,
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
  const otherParticipantIds = conv.participants
    .filter((p) => p.toString() !== userIdStr)
    .map((p) => p.toString())
  return { deleted: true, otherParticipantId: otherParticipantIds[0] || null, otherParticipantIds }
}
