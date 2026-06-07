import * as conversationService from '../services/conversation.service.js'
import * as uploadService from '../services/upload.service.js'
import { sendSuccess, sendError } from '../dto/index.js'
import { emitToUser } from '../config/socket.js'

/**
 * GET /conversations?with=:userId  => get or create conversation with that user, return conversation + messages
 * Or POST /conversations with body { otherUserId } for get-or-create
 */
export const getOrCreateWithUser = async (req, res, next) => {
  try {
    const myId = req.userId
    const otherUserId = req.query.with || req.body?.otherUserId
    if (!otherUserId) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing with (query) or otherUserId (body)' }, req)
    }
    const result = await conversationService.getOrCreateConversation(myId, otherUserId)
    return sendSuccess(res, { data: result }, req)
  } catch (error) {
    if (error.message === 'CANNOT_CHAT_SELF') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.cannotChatSelf' }, req)
    }
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    if (error.message === 'USER_BLOCKED') {
      return sendError(res, { statusCode: 403, messageKey: 'friend.blocked' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations => create group conversation (body: { type: 'group', name, participantIds })
 */
export const createConversation = async (req, res, next) => {
  try {
    if (req.body?.type !== 'group') {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Only type group is supported' }, req)
    }
    const name = req.body?.name
    const avatar = req.body?.avatar
    const participantIds = req.body?.participantIds
    const result = await conversationService.createGroupConversation(req.userId, { name, avatar, participantIds })
    return sendSuccess(res, { statusCode: 201, data: result }, req)
  } catch (error) {
    if (error.message === 'GROUP_NEED_AT_LEAST_ONE_MEMBER') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.groupNeedMembers', message: 'Add at least one member' }, req)
    }
    if (error.message === 'GROUP_NEED_AT_LEAST_TWO_MEMBERS') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.groupNeedTwoMembers', message: 'Select at least 2 members' }, req)
    }
    if (error.message === 'GROUP_EXCEED_MAX_MEMBERS') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.groupExceedMaxMembers', message: 'Group has reached maximum members' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * GET /conversations => list my conversations (optional ?q= for search by name)
 */
export const getMyConversations = async (req, res, next) => {
  try {
    const q = req.query?.q
    const list = await conversationService.getMyConversations(req.userId, q != null && q !== '' ? { q } : {})
    return sendSuccess(res, { data: list }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /conversations/for-forward => list conversations that have messages, paginated (limit=5, offset=0)
 */
export const getConversationsForForward = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query?.limit, 10) || 5))
    const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0)
    const result = await conversationService.getMyConversations(req.userId, { forForward: true, limit, offset })
    return sendSuccess(res, { data: result.data, total: result.total, hasMore: result.hasMore }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /conversations/unread-total => tổng tin nhắn chưa đọc (trừ hội thoại đã tắt thông báo)
 */
export const getUnreadTotal = async (req, res, next) => {
  try {
    const total = await conversationService.getUnreadTotal(req.userId)
    return sendSuccess(res, { data: { total } }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /conversations/:id/messages => get messages of a conversation (paginated)
 * Query: limit (default 10), before (messageId cursor for loading older messages)
 */
export const getMessages = async (req, res, next) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 10
    const before = req.query.before || null
    const messages = await conversationService.getMessages(req.params.id, req.userId, { limit, before })
    return sendSuccess(res, { data: messages }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/messages => send a message (body: { content } or multipart: content + files[])
 */
const ALLOWED_ATTACHMENT_URL_HOSTS = ['res.cloudinary.com', 'giphy.com', 'media.tenor.com', 'c.tenor.com']

function isAllowedAttachmentUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return ALLOWED_ATTACHMENT_URL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

export const sendMessage = async (req, res, next) => {
  try {
    const content = req.body?.content != null ? String(req.body.content) : ''
    const files = Array.isArray(req.files) ? req.files : []
    const hasFiles = files.length > 0
    let bodyAttachments = req.body?.attachments
    if (typeof bodyAttachments === 'string') {
      try {
        bodyAttachments = JSON.parse(bodyAttachments)
      } catch {
        bodyAttachments = []
      }
    }
    bodyAttachments = Array.isArray(bodyAttachments) ? bodyAttachments : []
    const urlAttachments = bodyAttachments
      .filter((a) => a && a.url && isAllowedAttachmentUrl(a.url))
      .map((a) => ({ url: a.url, name: a.name || 'GIF', type: a.type || 'image/gif' }))
    const hasUrlAttachments = urlAttachments.length > 0
    if (!content.trim() && !hasFiles && !hasUrlAttachments) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing content or file' }, req)
    }
    const attachments = [...urlAttachments]
    for (const file of files) {
      if (!file.buffer) continue
      const url = await uploadService.uploadMessageAttachment(
        file.buffer,
        file.mimetype,
        file.originalname
      )
      attachments.push({ url, name: file.originalname || null, type: file.mimetype || null })
    }
    const { message, otherParticipantIds } = await conversationService.sendMessage(
      req.params.id,
      req.userId,
      content.trim(),
      attachments
    )
    const io = req.app.get('io')
    if (io && Array.isArray(otherParticipantIds)) {
      otherParticipantIds.forEach((userId) => {
        emitToUser(io, userId, 'conversation:message', {
          conversationId: req.params.id,
          message,
        })
      })
    }
    return sendSuccess(res, { statusCode: 201, data: message }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'BLOCKED_BY_ME') {
      return sendError(res, { statusCode: 403, messageKey: 'conversation.youBlockedThisUser' }, req)
    }
    if (error.message === 'MESSAGE_CONTENT_REQUIRED') {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Content or file required' }, req)
    }
    // Cloudinary file size limit
    if (error.message?.includes('File size too large')) {
      return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'File too large. Maximum 10MB per file.' : 'File quá lớn. Tối đa 10MB mỗi file.' }, req)
    }
    next(error)
  }
}

/**
 * GET /conversations/attachment-download?url=...&name=... => proxy file download with Content-Disposition so browser saves (e.g. docx)
 */
export const downloadMessageAttachment = async (req, res, next) => {
  try {
    const rawUrl = req.query.url
    const name = (req.query.name || 'file').replace(/[^\w\s.-]/gi, '').trim() || 'file'
    if (!rawUrl || typeof rawUrl !== 'string') {
      return sendError(res, { statusCode: 400, message: 'Missing url' }, req)
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const allowedHost = `res.cloudinary.com`
    let parsed
    try {
      parsed = new URL(rawUrl)
    } catch {
      return sendError(res, { statusCode: 400, message: 'Invalid url' }, req)
    }
    if (parsed.hostname !== allowedHost || (cloudName && !rawUrl.includes(cloudName))) {
      return sendError(res, { statusCode: 403, message: 'Invalid attachment url' }, req)
    }
    const resp = await fetch(rawUrl, { method: 'GET' })
    if (!resp.ok) {
      return sendError(res, { statusCode: 502, message: 'Failed to fetch file' }, req)
    }
    const contentType = resp.headers.get('content-type') || 'application/octet-stream'
    const contentLength = resp.headers.get('content-length')
    const safeName = name.length > 200 ? name.slice(0, 200) : name
    res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"`)
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    res.flushHeaders?.()
    const buffer = await resp.arrayBuffer()
    return res.end(Buffer.from(buffer))
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /conversations/:id/messages/:messageId/reaction => toggle reaction (body: { emoji })
 */
export const reactToMessage = async (req, res, next) => {
  try {
    const emoji = req.body?.emoji
    if (emoji == null || typeof emoji !== 'string') {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing emoji' }, req)
    }
    const { message, otherParticipantIds } = await conversationService.reactToMessage(
      req.params.id,
      req.params.messageId,
      req.userId,
      emoji
    )
    const io = req.app.get('io')
    if (io && Array.isArray(otherParticipantIds)) {
      otherParticipantIds.forEach((userId) => {
        emitToUser(io, userId, 'conversation:messageReaction', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
          reactions: message.reactions,
        })
      })
    }
    return sendSuccess(res, { data: { messageId: req.params.messageId, reactions: message.reactions } }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND' || error.message === 'MESSAGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'INVALID_REACTION_EMOJI') {
      return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'Invalid reaction emoji' : 'Emoji reaction không hợp lệ' }, req)
    }
    next(error)
  }
}

/**
 * PATCH /conversations/:id/messages/:messageId => update message (chỉ khi người kia chưa xem). Body: content, attachments (JSON), hoặc multipart content + files
 */
export const updateMessage = async (req, res, next) => {
  try {
    const content = req.body?.content != null ? String(req.body.content) : ''
    const files = Array.isArray(req.files) ? req.files : []
    let bodyAttachments = req.body?.attachments
    if (typeof bodyAttachments === 'string') {
      try {
        bodyAttachments = JSON.parse(bodyAttachments)
      } catch {
        bodyAttachments = []
      }
    }
    bodyAttachments = Array.isArray(bodyAttachments) ? bodyAttachments : []
    const urlAttachments = bodyAttachments
      .filter((a) => a && a.url && isAllowedAttachmentUrl(a.url))
      .map((a) => ({ url: a.url, name: a.name || null, type: a.type || null }))
    const attachments = [...urlAttachments]
    for (const file of files) {
      if (!file.buffer) continue
      const url = await uploadService.uploadMessageAttachment(
        file.buffer,
        file.mimetype,
        file.originalname
      )
      attachments.push({ url, name: file.originalname || null, type: file.mimetype || null })
    }
    const hasContent = content.trim() || attachments.length > 0
    if (!hasContent) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing content or file' }, req)
    }
    const { message, otherParticipantIds } = await conversationService.updateMessage(
      req.params.id,
      req.params.messageId,
      req.userId,
      content.trim(),
      attachments
    )
    const io = req.app.get('io')
    if (io && Array.isArray(otherParticipantIds)) {
      otherParticipantIds.forEach((userId) => {
        emitToUser(io, userId, 'conversation:messageUpdated', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
          message,
        })
      })
    }
    return sendSuccess(res, { data: message }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND' || error.message === 'MESSAGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'MESSAGE_ALREADY_READ') {
      return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'Cannot edit: message already read' : 'Không thể sửa: tin nhắn đã được xem' }, req)
    }
    if (error.message === 'MESSAGE_CONTENT_REQUIRED') {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Content or file required' }, req)
    }
    if (error.message?.includes('File size too large')) {
      return sendError(res, { statusCode: 400, message: req.language === 'en' ? 'File too large.' : 'File quá lớn.' }, req)
    }
    next(error)
  }
}

/**
 * PATCH /conversations/:id/read => mark all messages in conversation as read for current user
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { otherParticipantIds } = await conversationService.markConversationAsRead(req.params.id, req.userId)
    const io = req.app.get('io')
    if (io && Array.isArray(otherParticipantIds)) {
      const readerUserId = req.userId?.toString?.() || req.userId
      otherParticipantIds.forEach((userId) => {
        emitToUser(io, userId, 'conversation:read', {
          conversationId: req.params.id,
          userId: readerUserId,
        })
      })
    }
    return sendSuccess(res, {}, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * PATCH /conversations/:id/settings => set mute / disappearing (body: { mutedUntil?, disappearingUntil?, disappearingDurationSeconds? })
 * disappearingDurationSeconds: 3600 (1h), 28800 (8h), 86400 (24h) - tin cũ hơn bị xóa thật khi user offline 5p.
 */
export const updateConversationSettings = async (req, res, next) => {
  try {
    const mutedUntil = req.body?.mutedUntil
    const disappearingUntil = req.body?.disappearingUntil
    const disappearingDurationSeconds = req.body?.disappearingDurationSeconds
    const result = await conversationService.updateSettings(req.params.id, req.userId, {
      ...(mutedUntil !== undefined && { mutedUntil: mutedUntil === null || mutedUntil === '' ? null : mutedUntil }),
      ...(disappearingUntil !== undefined && { disappearingUntil: disappearingUntil === null || disappearingUntil === '' ? null : disappearingUntil }),
      ...(disappearingDurationSeconds !== undefined && { disappearingDurationSeconds: disappearingDurationSeconds === null || disappearingDurationSeconds === '' ? null : disappearingDurationSeconds }),
    })
    return sendSuccess(res, { data: result }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * PATCH /conversations/:id/group-settings => cập nhật thông tin nhóm (chỉ type group).
 * Body: { name?, avatar?, maxMembers?, groupPermissions? }.
 * Chỉ host đổi được maxMembers và groupPermissions; host hoặc admin (nếu có quyền) đổi name/avatar.
 */
export const updateGroupSettings = async (req, res, next) => {
  try {
    const { name, avatar, maxMembers, groupPermissions } = req.body || {}
    const updated = await conversationService.updateGroupSettings(req.params.id, req.userId, {
      ...(name !== undefined && { name }),
      ...(avatar !== undefined && { avatar }),
      ...(maxMembers !== undefined && { maxMembers }),
      ...(groupPermissions !== undefined && { groupPermissions }),
    })
    const result = {
      id: updated._id?.toString(),
      name: updated.name ?? '',
      avatar: updated.avatar ?? '',
      maxMembers: updated.maxMembers ?? 50,
      groupPermissions: updated.groupPermissions
        ? {
            adminCanKick: !!updated.groupPermissions.adminCanKick,
            adminCanAddMembers: !!updated.groupPermissions.adminCanAddMembers,
            adminCanEditGroupInfo: !!updated.groupPermissions.adminCanEditGroupInfo,
            adminCanAssignUserPermissions: !!updated.groupPermissions.adminCanAssignUserPermissions,
            adminCanBlockUser: updated.groupPermissions.adminCanBlockUser !== false,
            userCanAddMembers: !!updated.groupPermissions.userCanAddMembers,
            userCanEditGroupInfo: !!updated.groupPermissions.userCanEditGroupInfo,
          }
        : undefined,
    }
    return sendSuccess(res, { data: result }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/members => thêm thành viên vào nhóm (body: { userIds: string[] }). Chỉ host/admin có quyền thêm.
 */
export const addMembersToGroup = async (req, res, next) => {
  try {
    const userIds = req.body?.userIds
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing userIds array' }, req)
    }
    const result = await conversationService.addMembersToGroup(req.params.id, userIds, req.userId)
    const io = req.app.get('io')
    if (io) {
      if (Array.isArray(result.addedUserIds)) {
        result.addedUserIds.forEach((userId) => {
          emitToUser(io, userId, 'conversation:membersAdded', {
            conversationId: result.conversationId,
          })
        })
      }
      if (result.systemMessage && Array.isArray(result.participantIds) && result.participantIds.length) {
        result.participantIds.forEach((uid) => {
          emitToUser(io, uid, 'conversation:message', {
            conversationId: result.conversationId,
            message: result.systemMessage,
          })
        })
      }
    }
    const { systemMessage: _sm, ...dataToSend } = result
    return sendSuccess(res, { data: dataToSend }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'NO_VALID_MEMBERS_TO_ADD') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.noValidMembersToAdd' }, req)
    }
    if (error.message === 'GROUP_EXCEED_MAX_MEMBERS') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.groupExceedMaxMembers' }, req)
    }
    next(error)
  }
}

/**
 * PATCH /conversations/:id/members/:userId/role => đặt role thành viên (body: { role: 'admin' | 'user' }). Chỉ host mới được gọi.
 */
export const setMemberRole = async (req, res, next) => {
  try {
    const role = req.body?.role
    if (!role || (role !== 'admin' && role !== 'user')) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'role must be "admin" or "user"' }, req)
    }
    const result = await conversationService.setMemberRoleInGroup(
      req.params.id,
      req.params.userId,
      role,
      req.userId
    )
    const io = req.app.get('io')
    if (io && Array.isArray(result.participantIds) && result.participantIds.length) {
      result.participantIds.forEach((uid) => {
        emitToUser(io, uid, 'conversation:memberRoleChanged', {
          conversationId: result.conversationId,
          userId: result.userId,
          role: result.role,
        })
      })
      if (result.systemMessage) {
        result.participantIds.forEach((uid) => {
          emitToUser(io, uid, 'conversation:message', {
            conversationId: result.conversationId,
            message: result.systemMessage,
          })
        })
      }
    }
    const { systemMessage: _sm, ...dataToSend } = result
    return sendSuccess(res, { data: dataToSend }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'USER_NOT_IN_GROUP') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.userNotInGroup' }, req)
    }
    if (error.message === 'CANNOT_CHANGE_HOST_ROLE') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.cannotChangeHostRole' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/block => chặn thành viên khỏi nhóm (body: { userId }). Chỉ host/admin có quyền kick.
 */
export const blockUserInGroup = async (req, res, next) => {
  try {
    const targetUserId = req.body?.userId
    if (!targetUserId) {
      return sendError(res, { statusCode: 400, messageKey: 'common.missingParam', message: 'Missing userId' }, req)
    }
    const result = await conversationService.blockUserInGroup(req.params.id, targetUserId, req.userId)
    const io = req.app.get('io')
    if (io && result.blockedUserId) {
      emitToUser(io, result.blockedUserId, 'conversation:memberBlocked', {
        conversationId: result.conversationId,
      })
    }
    return sendSuccess(res, { data: result }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    if (error.message === 'USER_NOT_IN_GROUP') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.userNotInGroup' }, req)
    }
    if (error.message === 'CANNOT_BLOCK_HOST') {
      return sendError(res, { statusCode: 400, messageKey: 'conversation.cannotBlockHost' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/disband => giải tán nhóm. Chỉ host mới được gọi.
 */
export const disbandGroup = async (req, res, next) => {
  try {
    const result = await conversationService.disbandGroup(req.params.id, req.userId)
    const io = req.app.get('io')
    if (io && Array.isArray(result.participantIds)) {
      result.participantIds.forEach((uid) => {
        emitToUser(io, uid, 'conversation:disbanded', { conversationId: result.conversationId })
      })
    }
    return sendSuccess(res, { data: result }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/leave => rời nhóm. Mọi thành viên đều được gọi.
 */
export const leaveGroup = async (req, res, next) => {
  try {
    const result = await conversationService.leaveGroup(req.params.id, req.userId)
    const io = req.app.get('io')
    if (io) {
      emitToUser(io, result.leftUserId, 'conversation:left', { conversationId: result.conversationId, disbanded: result.disbanded || false })
      if (Array.isArray(result.participantIds) && result.participantIds.length) {
        const memberLeftPayload = {
          conversationId: result.conversationId,
          userId: result.leftUserId,
          userName: result.leftUserName,
        }
        result.participantIds.forEach((uid) => {
          emitToUser(io, uid, 'conversation:memberLeft', memberLeftPayload)
        })
        if (result.systemMessage) {
          result.participantIds.forEach((uid) => {
            emitToUser(io, uid, 'conversation:message', {
              conversationId: result.conversationId,
              message: result.systemMessage,
            })
          })
        }
      }
    }
    const { systemMessage: _sm, ...dataToSend } = result
    return sendSuccess(res, { data: dataToSend }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * DELETE /conversations/:id/block/:userId => bỏ chặn thành viên. Chỉ host/admin có quyền kick.
 */
export const unblockUserInGroup = async (req, res, next) => {
  try {
    const result = await conversationService.unblockUserInGroup(req.params.id, req.params.userId, req.userId)
    const io = req.app.get('io')
    if (io && Array.isArray(result.participantIds) && result.participantIds.length) {
      result.participantIds.forEach((uid) => {
        emitToUser(io, uid, 'conversation:memberUnblocked', {
          conversationId: result.conversationId,
          unblockedUserId: result.unblockedUserId,
        })
      })
    }
    const { participantIds: _p, ...dataToSend } = result
    return sendSuccess(res, { data: dataToSend }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * DELETE /conversations/:id/messages/:messageId => xóa mềm (body: { scope: 'me' | 'everyone' })
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const scope = req.body?.scope === 'everyone' ? 'everyone' : 'me'
    if (scope === 'everyone') {
      const result = await conversationService.deleteMessageForEveryone(req.params.id, req.params.messageId, req.userId)
      const io = req.app.get('io')
      if (io && Array.isArray(result.otherParticipantIds)) {
        result.otherParticipantIds.forEach((userId) => {
          emitToUser(io, userId, 'conversation:messageDeleted', {
            conversationId: req.params.id,
            messageId: req.params.messageId,
          })
        })
      }
      return sendSuccess(res, { data: { deleted: true } }, req)
    }
    await conversationService.deleteMessageForMe(req.params.id, req.params.messageId, req.userId)
    return sendSuccess(res, { data: { deleted: true } }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND' || error.message === 'MESSAGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

/**
 * POST /conversations/:id/messages/delete-all => xóa toàn bộ tin nhắn (cho tôi) – cập nhật bucket
 */
export const deleteAllMessagesForMe = async (req, res, next) => {
  try {
    await conversationService.deleteAllMessagesForMe(req.params.id, req.userId)
    return sendSuccess(res, { data: { deleted: true } }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}
