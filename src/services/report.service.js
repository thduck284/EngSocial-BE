import mongoose from 'mongoose'
import { ContentReport, Post, Message, Conversation, User } from '../models/index.js'

function assertObjectId(id, errCode = 'INVALID_TARGET_ID') {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) throw new Error(errCode)
  return new mongoose.Types.ObjectId(id)
}

async function assertNotDuplicatePending(reporterId, targetType, targetId) {
  const existing = await ContentReport.findOne({
    reporterId,
    targetType,
    targetId,
    status: 'pending',
  })
    .select('_id')
    .lean()
  if (existing) throw new Error('REPORT_DUPLICATE_PENDING')
}

/**
 * @param {string|mongoose.Types.ObjectId} reporterId
 * @param {{ targetType: string, targetId: string, reason: string, details?: string }} body
 */
export const createContentReport = async (reporterId, { targetType, targetId, reason, details }) => {
  const rid = assertObjectId(reporterId)
  const normalizedType = typeof targetType === 'string' ? targetType.trim() : ''
  if (!['post', 'message', 'conversation', 'user'].includes(normalizedType)) {
    throw new Error('INVALID_TARGET_TYPE')
  }
  const tid = assertObjectId(targetId)
  const reasonStr = typeof reason === 'string' ? reason.trim() : ''
  if (!reasonStr) throw new Error('REPORT_REASON_REQUIRED')
  const detailsStr = typeof details === 'string' ? details.trim().slice(0, 2000) : ''

  await assertNotDuplicatePending(rid, normalizedType, tid)

  let contextConversationId = null

  if (normalizedType === 'post') {
    const post = await Post.findById(tid).select('status').lean()
    if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  } else if (normalizedType === 'message') {
    const msg = await Message.findById(tid).select('conversationId senderId messageType deletedAt').lean()
    if (!msg || msg.deletedAt) throw new Error('MESSAGE_NOT_FOUND')
    if (msg.messageType === 'system') throw new Error('CANNOT_REPORT_SYSTEM_MESSAGE')
    if (String(msg.senderId) === String(rid)) throw new Error('CANNOT_REPORT_OWN_MESSAGE')
    const conv = await Conversation.findById(msg.conversationId).select('participants').lean()
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
    const isParticipant = (conv.participants || []).some((p) => String(p) === String(rid))
    if (!isParticipant) throw new Error('FORBIDDEN')
    contextConversationId = msg.conversationId
  } else if (normalizedType === 'conversation') {
    const conv = await Conversation.findById(tid).select('type participants').lean()
    if (!conv) throw new Error('CONVERSATION_NOT_FOUND')
    if (conv.type !== 'group') throw new Error('NOT_GROUP_CONVERSATION')
    const isParticipant = (conv.participants || []).some((p) => String(p) === String(rid))
    if (!isParticipant) throw new Error('FORBIDDEN')
  } else if (normalizedType === 'user') {
    if (String(tid) === String(rid)) throw new Error('CANNOT_REPORT_SELF')
    const u = await User.findById(tid).select('_id').lean()
    if (!u) throw new Error('USER_NOT_FOUND')
  }

  const doc = await ContentReport.create({
    reporterId: rid,
    targetType: normalizedType,
    targetId: tid,
    contextConversationId,
    reason: reasonStr.slice(0, 120),
    details: detailsStr,
    status: 'pending',
  })

  return { id: doc._id.toString() }
}
