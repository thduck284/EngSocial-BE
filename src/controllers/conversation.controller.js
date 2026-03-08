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
    next(error)
  }
}

/**
 * GET /conversations => list my conversations
 */
export const getMyConversations = async (req, res, next) => {
  try {
    const list = await conversationService.getMyConversations(req.userId)
    return sendSuccess(res, { data: list }, req)
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
 * GET /conversations/:id/messages => get messages of a conversation
 */
export const getMessages = async (req, res, next) => {
  try {
    const messages = await conversationService.getMessages(req.params.id, req.userId)
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
    const { message, otherParticipantId } = await conversationService.sendMessage(
      req.params.id,
      req.userId,
      content.trim(),
      attachments
    )
    const io = req.app.get('io')
    if (io && otherParticipantId) {
      emitToUser(io, otherParticipantId, 'conversation:message', {
        conversationId: req.params.id,
        message,
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
    const { message, otherParticipantId } = await conversationService.reactToMessage(
      req.params.id,
      req.params.messageId,
      req.userId,
      emoji
    )
    const io = req.app.get('io')
    if (io && otherParticipantId) {
      emitToUser(io, otherParticipantId, 'conversation:messageReaction', {
        conversationId: req.params.id,
        messageId: req.params.messageId,
        reactions: message.reactions,
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
    const { message, otherParticipantId } = await conversationService.updateMessage(
      req.params.id,
      req.params.messageId,
      req.userId,
      content.trim(),
      attachments
    )
    const io = req.app.get('io')
    if (io && otherParticipantId) {
      emitToUser(io, otherParticipantId, 'conversation:messageUpdated', {
        conversationId: req.params.id,
        messageId: req.params.messageId,
        message,
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
    const otherParticipantId = await conversationService.markConversationAsRead(req.params.id, req.userId)
    const io = req.app.get('io')
    if (io && otherParticipantId) {
      emitToUser(io, otherParticipantId, 'conversation:read', {
        conversationId: req.params.id,
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
 * DELETE /conversations/:id/messages/:messageId => xóa mềm (body: { scope: 'me' | 'everyone' })
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const scope = req.body?.scope === 'everyone' ? 'everyone' : 'me'
    if (scope === 'everyone') {
      const result = await conversationService.deleteMessageForEveryone(req.params.id, req.params.messageId, req.userId)
      const io = req.app.get('io')
      if (io && result.otherParticipantId) {
        emitToUser(io, result.otherParticipantId, 'conversation:messageDeleted', {
          conversationId: req.params.id,
          messageId: req.params.messageId,
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
