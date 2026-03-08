import * as adminService from '../services/admin.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

// ========== USER MANAGEMENT ==========

export const getUsers = async (req, res, next) => {
  try {
    const { role, status, search, page, limit } = req.query
    const result = await adminService.getUsers({ role, status, search, page, limit })
    return sendPaginated(res, {
      messageKey: 'admin.usersSuccess',
      data: result.users,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateUserRole = async (req, res, next) => {
  try {
    const user = await adminService.updateUserRole(req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'admin.roleUpdated',
      data: { user },
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    next(error)
  }
}

export const updateUserStatus = async (req, res, next) => {
  try {
    const user = await adminService.updateUserStatus(req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'admin.statusUpdated',
      data: { user },
    }, req)
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    next(error)
  }
}

// ========== CONTENT MANAGEMENT ==========

export const getAllLessons = async (req, res, next) => {
  try {
    const { skill, status, createdBy, page, limit } = req.query
    const result = await adminService.getAllLessons({ skill, status, createdBy, page, limit })
    return sendPaginated(res, {
      messageKey: 'admin.lessonsSuccess',
      data: result.lessons,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateLessonStatus = async (req, res, next) => {
  try {
    const lesson = await adminService.updateLessonStatus(req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'admin.lessonStatusUpdated',
      data: { lesson },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

// ========== SOCIAL MODERATION ==========

export const getFlaggedPosts = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await adminService.getFlaggedPosts({ page, limit })
    return sendPaginated(res, {
      messageKey: 'admin.flaggedPostsSuccess',
      data: result.posts,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const moderatePost = async (req, res, next) => {
  try {
    const post = await adminService.moderatePost(req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'admin.postModerated',
      data: { post },
    }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    next(error)
  }
}

export const moderateComment = async (req, res, next) => {
  try {
    await adminService.moderateComment(req.params.id, req.body)
    return sendSuccess(res, { messageKey: 'admin.commentModerated' }, req)
  } catch (error) {
    if (error.message === 'COMMENT_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.commentNotFound' }, req)
    }
    next(error)
  }
}

// ========== STATISTICS ==========

export const getSystemStats = async (req, res, next) => {
  try {
    const stats = await adminService.getSystemStats()
    return sendSuccess(res, {
      messageKey: 'admin.statsSuccess',
      data: { stats },
    }, req)
  } catch (error) {
    next(error)
  }
}
