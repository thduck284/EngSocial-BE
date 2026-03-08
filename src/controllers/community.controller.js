import * as communityService from '../services/community.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

// ========== POSTS ==========

export const getPosts = async (req, res, next) => {
  try {
    const { visibility, groupId, authorId, search, page, limit } = req.query
    const result = await communityService.getPosts({ visibility, groupId, authorId, search, page, limit })
    return sendPaginated(res, {
      messageKey: 'community.listSuccess',
      data: result.posts,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getPostById = async (req, res, next) => {
  try {
    const post = await communityService.getPostById(req.params.id)
    return sendSuccess(res, {
      messageKey: 'community.detailSuccess',
      data: { post },
    }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    next(error)
  }
}

export const createPost = async (req, res, next) => {
  try {
    const post = await communityService.createPost(req.userId, req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'community.postCreated',
      data: { post },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updatePost = async (req, res, next) => {
  try {
    const post = await communityService.updatePost(req.userId, req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'community.postUpdated',
      data: { post },
    }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

export const deletePost = async (req, res, next) => {
  try {
    await communityService.deletePost(req.userId, req.params.id)
    return sendSuccess(res, { messageKey: 'community.postDeleted' }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

export const toggleLike = async (req, res, next) => {
  try {
    const result = await communityService.toggleLike(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: result.liked ? 'community.liked' : 'community.unliked',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    next(error)
  }
}

// ========== COMMENTS ==========

export const getComments = async (req, res, next) => {
  try {
    const { parentId, page, limit } = req.query
    const result = await communityService.getComments(req.params.postId, { parentId, page, limit })
    return sendPaginated(res, {
      messageKey: 'community.commentsSuccess',
      data: result.comments,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const createComment = async (req, res, next) => {
  try {
    const comment = await communityService.createComment(req.userId, req.params.postId, req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'community.commentCreated',
      data: { comment },
    }, req)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    next(error)
  }
}

export const deleteComment = async (req, res, next) => {
  try {
    await communityService.deleteComment(req.userId, req.params.commentId)
    return sendSuccess(res, { messageKey: 'community.commentDeleted' }, req)
  } catch (error) {
    if (error.message === 'COMMENT_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.commentNotFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}
