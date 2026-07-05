import { User, Lesson, Post, Comment, ContentReport, RefreshToken, PasswordResetToken, Message, Conversation } from '../models/index.js'
import { UserDTO, LessonDTO, PostDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { hashPassword } from '../utils/index.js'
import { indexUser, deleteUserFromIndex } from '../config/elasticsearch/userSearch.service.js'
import { sendUserStatusChangeEmail, sendReportResolutionEmail, resolveAccountEmailLang, getAccountStatusLabels, getAccountStatusChangeDetail } from './email.service.js'
import * as notificationService from './notification.service.js'
import { emitToUser } from '../config/socket.js'
import { getMessage } from '../locales/messages.js'

// ========== USER MANAGEMENT ==========

/**
 * Get all users (admin)
 */
export const getUsers = async ({ role, status, search, page = 1, limit = 20 }) => {
  const filter = {}
  if (role) filter.role = role
  if (status) filter.status = status
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await User.countDocuments(filter)
  const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage)

  return {
    users: users.map(u => new UserDTO(u)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Chi tiết một user (admin)
 */
export const getUserByIdForAdmin = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  return new UserDTO(user)
}

/**
 * Cập nhật hồ sơ user (admin): name, email, phone, bio, address, gender, dateOfBirth, avatar
 */
export const updateUserByAdmin = async (targetUserId, updates = {}) => {
  const user = await User.findById(targetUserId)
  if (!user) throw new Error('USER_NOT_FOUND')

  if (updates.email !== undefined) {
    const e = String(updates.email).trim().toLowerCase()
    if (e && e !== user.email) {
      const exists = await User.findOne({ email: e, _id: { $ne: targetUserId } }).select('_id').lean()
      if (exists) throw new Error('EMAIL_EXISTS')
      user.email = e
    }
  }
  if (updates.name !== undefined) user.name = String(updates.name).trim()
  if (updates.phone !== undefined) user.phone = updates.phone === '' ? undefined : String(updates.phone).trim()
  if (updates.bio !== undefined) user.bio = updates.bio === '' ? undefined : String(updates.bio)
  if (updates.address !== undefined) user.address = updates.address === '' ? undefined : String(updates.address).trim()
  if (updates.dateOfBirth !== undefined) {
    if (updates.dateOfBirth === null || updates.dateOfBirth === '') {
      user.dateOfBirth = null
    } else {
      const d = new Date(updates.dateOfBirth)
      user.dateOfBirth = Number.isNaN(d.getTime()) ? null : d
    }
  }
  if (updates.gender !== undefined) {
    user.gender = ['male', 'female', 'other'].includes(updates.gender) ? updates.gender : ''
  }
  if (updates.avatar !== undefined) {
    user.avatar = updates.avatar === '' ? undefined : String(updates.avatar).trim()
    user.markModified('avatar')
  }

  await user.save()
  const updated = await User.findById(targetUserId)
  try {
    await indexUser({
      id: updated._id.toString(),
      name: updated.name,
      email: updated.email,
      updatedAt: updated.updatedAt,
    })
  } catch (_) {}
  return new UserDTO(updated)
}

/**
 * Đặt lại mật khẩu user (admin)
 */
export const setUserPasswordByAdmin = async (targetUserId, { password }) => {
  const user = await User.findById(targetUserId).select('+password')
  if (!user) throw new Error('USER_NOT_FOUND')
  user.password = await hashPassword(password)
  await user.save()
  return true
}

/**
 * Xóa user khỏi hệ thống (admin). Không cho xóa chính mình hoặc admin cuối cùng.
 */
export const deleteUserByAdmin = async (requesterId, targetUserId) => {
  if (String(requesterId) === String(targetUserId)) throw new Error('CANNOT_DELETE_SELF')
  const user = await User.findById(targetUserId).select('role').lean()
  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' })
    if (adminCount <= 1) throw new Error('CANNOT_DELETE_LAST_ADMIN')
  }
  await RefreshToken.deleteMany({ userId: targetUserId })
  await PasswordResetToken.deleteMany({ userId: targetUserId })
  await User.findByIdAndDelete(targetUserId)
  try {
    await deleteUserFromIndex(String(targetUserId))
  } catch (_) {}
  return { deleted: true }
}

/**
 * Update user role (admin)
 */
export const updateUserRole = async (userId, { role }) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!['user', 'admin', 'moderator'].includes(role)) throw new Error('INVALID_ROLE')
  if (user.role === 'admin' && role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' })
    if (adminCount <= 1) throw new Error('CANNOT_DEMOTE_LAST_ADMIN')
  }
  user.role = role
  await user.save()
  return new UserDTO(user)
}

/**
 * In-app + realtime notification when admin changes account status.
 */
async function notifyUserAccountStatusChange(io, user, { prevStatus, newStatus, notifyLang }) {
  const lang = resolveAccountEmailLang(user, notifyLang)
  const { prevLabel, newLabel } = getAccountStatusLabels(lang, prevStatus, newStatus)
  const title = getMessage(lang, 'notifications.accountStatusChangedTitle')
  const transition = getMessage(lang, 'notifications.accountStatusChangedMessage', { prevLabel, newLabel })
  const detail = getAccountStatusChangeDetail(lang, newStatus)
  const message = `${transition} ${detail}`

  const notification = await notificationService.createNotification({
    userId: user._id,
    type: 'system',
    title,
    message,
    relatedId: user._id,
    relatedType: 'user',
    data: {
      kind: 'account_status_change',
      prevStatus,
      newStatus,
      prevLabel,
      newLabel,
    },
  })

  if (io) {
    emitToUser(io, user._id, 'notification', notification)
  }

  return notification
}

const REPORT_STATUS_LABEL_KEYS = {
  pending: 'notifications.reportStatusLabelPending',
  reviewed: 'notifications.reportStatusLabelReviewed',
  dismissed: 'notifications.reportStatusLabelDismissed',
}

const REPORT_STATUS_DETAIL_KEYS = {
  pending: 'notifications.reportStatusDetailPending',
  reviewed: 'notifications.reportStatusDetailReviewed',
  dismissed: 'notifications.reportStatusDetailDismissed',
}

const REPORT_TARGET_TYPE_LABEL_KEYS = {
  post: 'notifications.reportTargetTypePost',
  user: 'notifications.reportTargetTypeUser',
  message: 'notifications.reportTargetTypeMessage',
  conversation: 'notifications.reportTargetTypeConversation',
}

function getReportStatusLabels(lang, prevStatus, newStatus) {
  return {
    prevLabel: getMessage(lang, REPORT_STATUS_LABEL_KEYS[prevStatus] || REPORT_STATUS_LABEL_KEYS.pending),
    newLabel: getMessage(lang, REPORT_STATUS_LABEL_KEYS[newStatus] || REPORT_STATUS_LABEL_KEYS.pending),
  }
}

function getReportStatusChangeDetail(lang, newStatus) {
  return getMessage(lang, REPORT_STATUS_DETAIL_KEYS[newStatus] || REPORT_STATUS_DETAIL_KEYS.pending)
}

function getReportTargetTypeLabel(lang, targetType) {
  return getMessage(lang, REPORT_TARGET_TYPE_LABEL_KEYS[targetType] || REPORT_TARGET_TYPE_LABEL_KEYS.post)
}

function getReportStatusNotificationContent(lang, { newStatus, targetTypeLabel, prevLabel, newLabel }) {
  if (newStatus === 'reviewed') {
    return {
      title: getMessage(lang, 'notifications.reportStatusAcceptedTitle'),
      message: getMessage(lang, 'notifications.reportStatusAcceptedMessage', { targetTypeLabel }),
    }
  }
  if (newStatus === 'dismissed') {
    return {
      title: getMessage(lang, 'notifications.reportStatusRejectedTitle'),
      message: getMessage(lang, 'notifications.reportStatusRejectedMessage', { targetTypeLabel }),
    }
  }
  return {
    title: getMessage(lang, 'notifications.reportStatusChangedTitle'),
    message: `${getMessage(lang, 'notifications.reportStatusChangedMessage', {
      prevLabel,
      newLabel,
      targetTypeLabel,
    })} ${getReportStatusChangeDetail(lang, newStatus)}`,
  }
}

/**
 * In-app + realtime notification when admin changes content report status.
 */
async function notifyReporterReportStatusChange(io, report, { prevStatus, newStatus, notifyLang }) {
  const reporter = await User.findById(report.reporterId).select('preferences.language name email')
  if (!reporter) return

  const lang = resolveAccountEmailLang(reporter, notifyLang)
  const { prevLabel, newLabel } = getReportStatusLabels(lang, prevStatus, newStatus)
  const targetTypeLabel = getReportTargetTypeLabel(lang, report.targetType)
  const { title, message } = getReportStatusNotificationContent(lang, {
    newStatus,
    targetTypeLabel,
    prevLabel,
    newLabel,
  })

  const relatedType = report.targetType === 'post' || report.targetType === 'user' ? report.targetType : undefined
  const relatedId = relatedType ? report.targetId : report._id

  const notification = await notificationService.createNotification({
    userId: reporter._id,
    type: 'system',
    title,
    message,
    relatedId,
    relatedType,
    data: {
      kind: 'report_status_change',
      reportId: report._id.toString(),
      prevStatus,
      newStatus,
      prevLabel,
      newLabel,
      outcome: newStatus === 'reviewed' ? 'accepted' : newStatus === 'dismissed' ? 'rejected' : 'pending',
      targetType: report.targetType,
      targetId: report.targetId?.toString(),
      reason: report.reason,
    },
  })

  if (io) {
    emitToUser(io, reporter._id, 'notification', notification)
  }

  return notification
}

/**
 * Update user status (admin) - ban/activate
 * @param {string} userId
 * @param {{ status: string }} body
 * @param {{ notifyLang?: string, io?: import('socket.io').Server }} [opts]
 */
export const updateUserStatus = async (userId, { status }, opts = {}) => {
  const notifyLang = opts.notifyLang || 'vi'
  const io = opts.io
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!['active', 'inactive', 'banned', 'pending'].includes(status)) throw new Error('INVALID_STATUS')
  const prevStatus = user.status
  if (prevStatus === status) {
    return new UserDTO(user)
  }
  user.status = status
  await user.save()
  void sendUserStatusChangeEmail(user, { prevStatus, newStatus: status, notifyLang })
  void notifyUserAccountStatusChange(io, user, { prevStatus, newStatus: status, notifyLang }).catch((err) => {
    console.error('[admin] notifyUserAccountStatusChange failed:', err?.message || err)
  })
  return new UserDTO(user)
}

// ========== CONTENT MANAGEMENT ==========

/**
 * Get all lessons for admin (including drafted)
 */
export const getAllLessons = async ({ skill, status, createdBy, page = 1, limit = 20 }) => {
  const filter = {}
  if (skill) filter.skill = skill
  if (status) filter.status = status
  if (createdBy) filter.createdBy = createdBy

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Lesson.countDocuments(filter)
  const lessons = await Lesson.find(filter)
    .select('-content -questions -vocabulary')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    lessons: lessons.map(l => new LessonDTO(l)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Approve/publish a lesson (admin)
 */
export const updateLessonStatus = async (lessonId, { status }) => {
  const lesson = await Lesson.findById(lessonId)
  if (!lesson) throw new Error('LESSON_NOT_FOUND')
  lesson.status = status
  if (status === 'published' && !lesson.publishedAt) {
    lesson.publishedAt = new Date()
  }
  await lesson.save()
  return new LessonDTO(lesson)
}

// ========== SOCIAL MODERATION ==========

/**
 * Get reported/flagged posts
 */
export const getFlaggedPosts = async ({ page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Post.countDocuments({ status: 'flagged' })
  const posts = await Post.find({ status: 'flagged' })
    .populate('authorId', 'name email avatar')
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    posts: posts.map(p => new PostDTO(p)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Moderate a post (admin)
 */
export const moderatePost = async (postId, { status }) => {
  const post = await Post.findById(postId)
  if (!post) throw new Error('POST_NOT_FOUND')
  post.status = status
  await post.save()
  return new PostDTO(post)
}

/**
 * Moderate a comment (admin)
 */
export const moderateComment = async (commentId, { status }) => {
  const comment = await Comment.findById(commentId)
  if (!comment) throw new Error('COMMENT_NOT_FOUND')
  comment.status = status
  await comment.save()
  return true
}

// ========== CONTENT REPORTS (admin) ==========

const REPORT_TARGET_PREVIEW_MAX = 160

function truncateReportText(text, max = REPORT_TARGET_PREVIEW_MAX) {
  const s = String(text || '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function mapReportAuthor(userDoc) {
  if (!userDoc) return null
  if (typeof userDoc === 'object' && userDoc._id) {
    return {
      id: userDoc._id.toString(),
      name: userDoc.name || '—',
      email: userDoc.email || '',
      avatar: userDoc.avatar || '',
    }
  }
  return null
}

async function loadAdminConversationMessages(conversationId) {
  const notDeletedForEveryone = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }
  const rows = await Message.find({ conversationId, ...notDeletedForEveryone })
    .populate('senderId', 'name email avatar')
    .sort({ createdAt: 1 })
    .lean()

  const messages = rows.map((m) => ({
    id: m._id.toString(),
    sender: mapReportAuthor(m.senderId),
    content: m.content || '',
    messageType: m.messageType || 'user',
    attachments: (m.attachments || []).map((a) => ({
      url: a?.url || '',
      name: a?.name || '',
      type: a?.type || '',
    })),
    createdAt: m.createdAt,
  }))

  return { messages, truncated: false }
}

async function enrichReportTargetPreviewForDetail(report, preview) {
  if (!preview?.found) return preview

  if (report.targetType === 'conversation') {
    const { messages, truncated } = await loadAdminConversationMessages(report.targetId)
    return {
      ...preview,
      viewPath: null,
      content: '',
      meta: {
        ...preview.meta,
        messages,
        messagesTruncated: truncated,
      },
    }
  }

  if (report.targetType === 'message') {
    return { ...preview, viewPath: null }
  }

  return preview
}

async function loadReportTargetMaps(rows) {
  const postIds = []
  const messageIds = []
  const conversationIds = []
  const userIds = []

  for (const r of rows) {
    const id = r.targetId
    if (!id) continue
    if (r.targetType === 'post') postIds.push(id)
    else if (r.targetType === 'message') messageIds.push(id)
    else if (r.targetType === 'conversation') conversationIds.push(id)
    else if (r.targetType === 'user') userIds.push(id)
    if (r.contextConversationId) conversationIds.push(r.contextConversationId)
  }

  const uniq = (arr) => [...new Set(arr.map(String))]

  const [posts, messages, conversations, users] = await Promise.all([
    postIds.length
      ? Post.find({ _id: { $in: uniq(postIds) } })
          .populate('authorId', 'name email avatar')
          .select('content images video status authorId createdAt')
          .lean()
      : [],
    messageIds.length
      ? Message.find({ _id: { $in: uniq(messageIds) } })
          .populate('senderId', 'name email avatar')
          .select('content attachments conversationId senderId messageType deletedAt createdAt')
          .lean()
      : [],
    conversationIds.length
      ? Conversation.find({ _id: { $in: uniq(conversationIds) } })
          .populate('participants', 'name email avatar')
          .select('name avatar type participants createdAt')
          .lean()
      : [],
    userIds.length
      ? User.find({ _id: { $in: uniq(userIds) } })
          .select('name email avatar bio status role createdAt')
          .lean()
      : [],
  ])

  return {
    posts: new Map(posts.map((p) => [String(p._id), p])),
    messages: new Map(messages.map((m) => [String(m._id), m])),
    conversations: new Map(conversations.map((c) => [String(c._id), c])),
    users: new Map(users.map((u) => [String(u._id), u])),
  }
}

function buildReportTargetPreview(report, maps) {
  const { targetType, targetId, contextConversationId } = report
  const empty = {
    found: false,
    unavailable: false,
    excerpt: '',
    content: '',
    label: '',
    author: null,
    images: [],
    attachments: [],
    video: null,
    status: null,
    createdAt: null,
    viewPath: null,
    conversationId: contextConversationId ? String(contextConversationId) : null,
    meta: {},
  }

  if (!targetId) return empty

  if (targetType === 'post') {
    const post = maps.posts.get(String(targetId))
    if (!post) return { ...empty, label: 'not_found' }
    const unavailable = post.status === 'deleted' || post.status === 'hidden'
    const author = mapReportAuthor(post.authorId)
    return {
      found: true,
      unavailable,
      label: author?.name || 'Post',
      excerpt: truncateReportText(post.content),
      content: post.content || '',
      author,
      images: (post.images || []).slice(0, 6),
      attachments: [],
      video: post.video || null,
      status: post.status,
      createdAt: post.createdAt,
      viewPath: `/post/${String(targetId)}`,
      conversationId: null,
      meta: { targetStatus: post.status },
    }
  }

  if (targetType === 'message') {
    const msg = maps.messages.get(String(targetId))
    if (!msg) return { ...empty, label: 'not_found' }
    const unavailable = !!msg.deletedAt || msg.messageType === 'system'
    const author = mapReportAuthor(msg.senderId)
    const convId = msg.conversationId ? String(msg.conversationId) : null
    const attachmentNames = (msg.attachments || []).map((a) => a?.name || a?.url).filter(Boolean)
    const text = msg.content || attachmentNames.join(', ')
    return {
      found: true,
      unavailable,
      label: author?.name || 'Message',
      excerpt: truncateReportText(text),
      content: msg.content || '',
      author,
      images: [],
      attachments: (msg.attachments || []).slice(0, 6).map((a) => ({
        url: a?.url || '',
        name: a?.name || '',
        type: a?.type || '',
      })),
      video: null,
      status: msg.deletedAt ? 'deleted' : msg.messageType,
      createdAt: msg.createdAt,
      viewPath: null,
      conversationId: convId || (contextConversationId ? String(contextConversationId) : null),
      meta: { messageType: msg.messageType },
    }
  }

  if (targetType === 'conversation') {
    const conv = maps.conversations.get(String(targetId))
    if (!conv) return { ...empty, label: 'not_found' }
    const memberCount = (conv.participants || []).length
    const label = conv.type === 'group' ? conv.name || 'Group' : 'Conversation'
    const memberNames = (conv.participants || [])
      .slice(0, 8)
      .map((p) => (typeof p === 'object' ? p.name : null))
      .filter(Boolean)
    const excerpt = memberNames.length
      ? memberNames.join(', ')
      : `${memberCount} member${memberCount === 1 ? '' : 's'}`
    return {
      found: true,
      unavailable: false,
      label,
      excerpt: truncateReportText(excerpt, 200),
      content: excerpt,
      author: null,
      images: conv.avatar ? [conv.avatar] : [],
      attachments: [],
      video: null,
      status: conv.type,
      createdAt: conv.createdAt,
      viewPath: null,
      conversationId: String(targetId),
      meta: { memberCount, members: (conv.participants || []).slice(0, 12).map(mapReportAuthor).filter(Boolean) },
    }
  }

  if (targetType === 'user') {
    const u = maps.users.get(String(targetId))
    if (!u) return { ...empty, label: 'not_found' }
    return {
      found: true,
      unavailable: u.status === 'banned' || u.status === 'inactive',
      label: u.name || 'User',
      excerpt: truncateReportText(u.bio || u.email || ''),
      content: u.bio || '',
      author: mapReportAuthor(u),
      images: u.avatar ? [u.avatar] : [],
      attachments: [],
      video: null,
      status: u.status,
      createdAt: u.createdAt,
      viewPath: `/profile/${String(targetId)}`,
      conversationId: null,
      meta: { email: u.email, role: u.role },
    }
  }

  return empty
}

async function resolveReportedUserForReport(report) {
  const reporterId = String(report.reporterId?._id || report.reporterId || '')
  const maps = await loadReportTargetMaps([report])
  const preview = buildReportTargetPreview(report, maps)

  if (report.targetType === 'user') {
    const u = maps.users.get(String(report.targetId))
    if (!u?.email) return null
    return { id: String(u._id), name: u.name, email: u.email }
  }

  if (preview.author?.email) {
    const authorId = String(preview.author.id || '')
    if (authorId && authorId !== reporterId) {
      return { id: authorId, name: preview.author.name, email: preview.author.email }
    }
  }

  if (report.targetType === 'conversation') {
    const conv = maps.conversations.get(String(report.targetId))
    const participant = (conv?.participants || []).find((p) => {
      const id = String(p?._id || p || '')
      return id && id !== reporterId && p?.email
    })
    if (participant && typeof participant === 'object') {
      return { id: String(participant._id), name: participant.name, email: participant.email }
    }
  }

  return null
}

function mapContentReportRow(r, targetPreview, reportedUser = null) {
  return {
    id: r._id.toString(),
    reporter: r.reporterId
      ? {
          id: r.reporterId._id?.toString(),
          name: r.reporterId.name,
          email: r.reporterId.email,
          avatar: r.reporterId.avatar,
        }
      : null,
    targetType: r.targetType,
    targetId: r.targetId?.toString(),
    contextConversationId: r.contextConversationId ? r.contextConversationId.toString() : null,
    reason: r.reason,
    details: r.details || '',
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    targetPreview,
    reportedUser,
  }
}

/**
 * Danh sách báo cáo (bảng ContentReport)
 */
export const getContentReports = async ({ page = 1, limit = 20, status, targetType }) => {
  const filter = {}
  if (status && ['pending', 'reviewed', 'dismissed'].includes(status)) filter.status = status
  if (targetType && ['post', 'message', 'conversation', 'user'].includes(targetType)) {
    filter.targetType = targetType
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await ContentReport.countDocuments(filter)
  const rows = await ContentReport.find(filter)
    .populate('reporterId', 'name email avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)
    .lean()

  const maps = await loadReportTargetMaps(rows)
  const reports = rows.map((r) => mapContentReportRow(r, buildReportTargetPreview(r, maps)))

  return {
    reports,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Chi tiết một báo cáo kèm nội dung đối tượng bị tố cáo
 */
export const getContentReportById = async (reportId) => {
  const row = await ContentReport.findById(reportId)
    .populate('reporterId', 'name email avatar')
    .lean()
  if (!row) throw new Error('REPORT_NOT_FOUND')
  const maps = await loadReportTargetMaps([row])
  const basePreview = buildReportTargetPreview(row, maps)
  const targetPreview = await enrichReportTargetPreviewForDetail(row, basePreview)
  const reportedUser = await resolveReportedUserForReport(row)
  return mapContentReportRow(row, targetPreview, reportedUser)
}

/**
 * Cập nhật trạng thái xử lý báo cáo
 * @param {string} reportId
 * @param {{ status: string }} body
 * @param {{ notifyLang?: string, io?: import('socket.io').Server }} [opts]
 */
export const updateContentReportStatus = async (
  reportId,
  { status, reporterMessage, reportedUserMessage },
  opts = {},
) => {
  if (!['pending', 'reviewed', 'dismissed'].includes(status)) {
    throw new Error('INVALID_REPORT_STATUS')
  }
  const report = await ContentReport.findById(reportId)
  if (!report) throw new Error('REPORT_NOT_FOUND')

  const prevStatus = report.status
  if (prevStatus === status) {
    return { id: report._id.toString(), status: report.status }
  }

  report.status = status
  await report.save()

  void notifyReporterReportStatusChange(opts.io, report, {
    prevStatus,
    newStatus: status,
    notifyLang: opts.notifyLang || 'vi',
  }).catch((err) => {
    console.error('[admin] notifyReporterReportStatusChange failed:', err?.message || err)
  })

  if (status === 'reviewed' || status === 'dismissed') {
    const reportLean = await ContentReport.findById(reportId)
      .populate('reporterId', 'name email preferences.language')
      .lean()
    const reportedUser = reportLean ? await resolveReportedUserForReport(reportLean) : null
    const notifyLang = opts.notifyLang || 'vi'

    if (reporterMessage?.trim() && reportLean?.reporterId?.email) {
      const lang = resolveAccountEmailLang(reportLean.reporterId, notifyLang)
      void sendReportResolutionEmail(reportLean.reporterId.email, {
        name: reportLean.reporterId.name,
        body: reporterMessage.trim(),
        lang,
      }).catch((err) => {
        console.error('[admin] sendReportResolutionEmail reporter failed:', err?.message || err)
      })
    }

    if (reportedUserMessage?.trim() && reportedUser?.email) {
      const reportedDoc = await User.findById(reportedUser.id).select('name email preferences.language').lean()
      const lang = resolveAccountEmailLang(reportedDoc || reportedUser, notifyLang)
      void sendReportResolutionEmail(reportedUser.email, {
        name: reportedUser.name,
        body: reportedUserMessage.trim(),
        lang,
      }).catch((err) => {
        console.error('[admin] sendReportResolutionEmail reported user failed:', err?.message || err)
      })
    }
  }

  return { id: report._id.toString(), status: report.status }
}

// ========== STATISTICS ==========

function calendarMonthBounds(ref = new Date()) {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const thisMonthStart = new Date(y, m, 1, 0, 0, 0, 0)
  const nextMonthStart = new Date(y, m + 1, 1, 0, 0, 0, 0)
  const lastMonthStart = new Date(y, m - 1, 1, 0, 0, 0, 0)
  return { thisMonthStart, nextMonthStart, lastMonthStart }
}

function deltaPercent(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export const getSystemStats = async () => {
  const { thisMonthStart, nextMonthStart, lastMonthStart } = calendarMonthBounds()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [
    totalUsers,
    activeUsers,
    totalLessons,
    publishedLessons,
    totalPosts,
    totalComments,
    newUsersThisWeek,
    usersNewThisMonth,
    usersNewLastMonth,
    totalReports,
    pendingReports,
    reportsNewThisMonth,
    reportsNewLastMonth,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    Lesson.countDocuments(),
    Lesson.countDocuments({ status: 'published' }),
    Post.countDocuments({ status: 'active' }),
    Comment.countDocuments({ status: 'active' }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({
      createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
    }),
    User.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
    }),
    ContentReport.countDocuments(),
    ContentReport.countDocuments({ status: 'pending' }),
    ContentReport.countDocuments({
      createdAt: { $gte: thisMonthStart, $lt: nextMonthStart },
    }),
    ContentReport.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
    }),
  ])

  const userDelta = usersNewThisMonth - usersNewLastMonth
  const reportDelta = reportsNewThisMonth - reportsNewLastMonth

  return {
    users: { total: totalUsers, active: activeUsers, newThisWeek: newUsersThisWeek },
    lessons: { total: totalLessons, published: publishedLessons },
    community: { posts: totalPosts, comments: totalComments },
    overview: {
      monthYear: thisMonthStart.getFullYear(),
      monthIndex: thisMonthStart.getMonth() + 1,
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: usersNewThisMonth,
        newLastMonth: usersNewLastMonth,
        deltaVsLastMonth: userDelta,
        percentVsLastMonth: deltaPercent(usersNewThisMonth, usersNewLastMonth),
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        newThisMonth: reportsNewThisMonth,
        newLastMonth: reportsNewLastMonth,
        deltaVsLastMonth: reportDelta,
        percentVsLastMonth: deltaPercent(reportsNewThisMonth, reportsNewLastMonth),
      },
    },
  }
}
