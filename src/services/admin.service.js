import { User, Lesson, Post, Comment, ContentReport, RefreshToken, PasswordResetToken } from '../models/index.js'
import { UserDTO, LessonDTO, PostDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { hashPassword } from '../utils/index.js'
import { indexUser, deleteUserFromIndex } from '../config/elasticsearch/userSearch.service.js'
import { sendUserStatusChangeEmail } from './email.service.js'

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
 * Update user status (admin) - ban/activate
 * @param {string} userId
 * @param {{ status: string }} body
 * @param {{ notifyLang?: string }} [opts] - Ngôn ngữ fallback cho email (Accept-Language); ưu tiên user.preferences.language
 */
export const updateUserStatus = async (userId, { status }, opts = {}) => {
  const notifyLang = opts.notifyLang || 'vi'
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

// ========== STATISTICS ==========

/**
 * Get system statistics (admin dashboard)
 */
// ========== CONTENT REPORTS (admin) ==========

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

  const reports = rows.map((r) => ({
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
  }))

  return {
    reports,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Cập nhật trạng thái xử lý báo cáo
 */
export const updateContentReportStatus = async (reportId, { status }) => {
  if (!['pending', 'reviewed', 'dismissed'].includes(status)) {
    throw new Error('INVALID_REPORT_STATUS')
  }
  const doc = await ContentReport.findByIdAndUpdate(
    reportId,
    { status },
    { new: true }
  )
    .select('_id status')
    .lean()
  if (!doc) throw new Error('REPORT_NOT_FOUND')
  return { id: doc._id.toString(), status: doc.status }
}

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
