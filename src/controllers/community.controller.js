import { Readable } from 'stream'
import * as communityService from '../services/community.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

// ========== POSTS ==========

export const getPosts = async (req, res, next) => {
  try {
    const { visibility, groupId, authorId, search, page, limit } = req.query
    const viewerId = req.userId || null
    const result = await communityService.getPosts({ visibility, groupId, authorId, search, page, limit, viewerId })
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
    const viewerId = req.userId || null
    const post = await communityService.getPostById(req.params.id, viewerId)
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

/** Safe filename for Content-Disposition (strip path and non-printable) */
function safeAttachmentFilename(name) {
  if (!name || typeof name !== 'string') return 'document'
  const base = name.replace(/^.*[/\\]/, '').replace(/[^\w.\- ]/gi, '_')
  return base.trim() || 'document'
}

export const downloadPostDocument = async (req, res, next) => {
  try {
    const { postId, index } = req.params
    const { url, name } = await communityService.getPostDocument(postId, index)
    const fetchRes = await fetch(url, { redirect: 'follow' })
    if (!fetchRes.ok) {
      return sendError(res, { statusCode: 502, messageKey: 'common.error', message: 'Failed to fetch document' }, req)
    }
    const filename = safeAttachmentFilename(name)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    const contentType = fetchRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    const nodeStream = Readable.fromWeb(fetchRes.body)
    nodeStream.pipe(res)
  } catch (error) {
    if (error.message === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    if (error.message === 'DOCUMENT_NOT_FOUND') {
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

export const setReaction = async (req, res, next) => {
  try {
    const { reaction } = req.body || {}
    const result = await communityService.setReaction(req.userId, req.params.id, reaction)
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

export const getPostReactions = async (req, res, next) => {
  try {
    const result = await communityService.getPostReactions(req.params.id)
    return sendSuccess(res, {
      messageKey: 'community.reactionsSuccess',
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
