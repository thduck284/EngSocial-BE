import { User, Lesson, Post, Comment } from '../models/index.js'
import { UserDTO, LessonDTO, PostDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

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
 * Update user role (admin)
 */
export const updateUserRole = async (userId, { role }) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!['user', 'admin', 'moderator'].includes(role)) throw new Error('INVALID_ROLE')
  user.role = role
  await user.save()
  return new UserDTO(user)
}

/**
 * Update user status (admin) - ban/activate
 */
export const updateUserStatus = async (userId, { status }) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!['active', 'inactive', 'banned'].includes(status)) throw new Error('INVALID_STATUS')
  user.status = status
  await user.save()
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
export const getSystemStats = async () => {
  const [
    totalUsers,
    activeUsers,
    totalLessons,
    publishedLessons,
    totalPosts,
    totalComments,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    Lesson.countDocuments(),
    Lesson.countDocuments({ status: 'published' }),
    Post.countDocuments({ status: 'active' }),
    Comment.countDocuments({ status: 'active' }),
  ])

  // New users this week
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } })

  return {
    users: { total: totalUsers, active: activeUsers, newThisWeek: newUsersThisWeek },
    lessons: { total: totalLessons, published: publishedLessons },
    community: { posts: totalPosts, comments: totalComments },
  }
}
