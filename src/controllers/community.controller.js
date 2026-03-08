import Post from '../models/social/Post.js'
import { PostDetailDTO } from '../dto/social/response/post.response.js'
import { sendSuccess, sendPaginated } from '../dto/index.js'

/**
 * GET /api/community/posts
 * List posts (public, status active). Optional: page, limit.
 */
export const getPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
    const skip = (pageNum - 1) * limitNum

    const filter = { status: 'active' }
    const [total, posts] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter)
        .populate('authorId', 'name avatar level totalXp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ])

    const data = posts.map((p) => {
      const author = p.authorId
      const postObj = { ...p, authorId: p.authorId?._id || p.authorId }
      return new PostDetailDTO(postObj, author).toJSON()
    })

    const totalPages = Math.ceil(total / limitNum)
    return sendSuccess(res, {
      data,
      meta: { pagination: { currentPage: pageNum, perPage: limitNum, total, totalPages } },
    }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/community/posts
 * Create a post (auth required).
 * Body: { content, images?, visibility? }
 */
export const createPost = async (req, res, next) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { content, images = [], video, documents = [], visibility = 'public' } = req.body || {}
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Content is required' })
    }

    const post = await Post.create({
      authorId: userId,
      content: content.trim().slice(0, 5000),
      images: Array.isArray(images) ? images.slice(0, 10) : [],
      video: video && typeof video === 'string' ? video : undefined,
      documents: Array.isArray(documents) ? documents.slice(0, 5) : [],
      visibility: ['public', 'friends', 'group', 'private'].includes(visibility) ? visibility : 'public',
      status: 'active',
    })

    const populated = await Post.findById(post._id)
      .populate('authorId', 'name avatar level totalXp')
      .lean()
    const author = populated?.authorId
    const postObj = { ...populated, authorId: populated?.authorId?._id || populated?.authorId }
    const data = new PostDetailDTO(postObj, author).toJSON()

    return sendSuccess(res, { data, statusCode: 201 }, req)
  } catch (error) {
    next(error)
  }
}
