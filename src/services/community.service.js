import { Post, PostLike, Comment, User } from '../models/index.js'
import { PostDTO, PostDetailDTO, CommentDTO, CommentDetailDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Get posts feed (public + friends)
 */
export const getPosts = async ({ visibility = 'public', groupId, authorId, search, page = 1, limit = 10 }) => {
  const filter = { status: 'active' }
  if (visibility) filter.visibility = visibility
  if (groupId) filter.groupId = groupId
  if (authorId) filter.authorId = authorId
  if (search) filter.$text = { $search: search }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Post.countDocuments(filter)
  const posts = await Post.find(filter)
    .populate('authorId', 'name avatar level totalXp')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  const postDTOs = posts.map(p => new PostDetailDTO(p, p.authorId))
  return {
    posts: postDTOs,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get single post detail
 */
export const getPostById = async (postId) => {
  const post = await Post.findById(postId)
    .populate('authorId', 'name avatar level totalXp')
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  return new PostDetailDTO(post, post.authorId)
}

/**
 * Create a post
 */
export const createPost = async (userId, data) => {
  const post = await Post.create({
    authorId: userId,
    content: data.content,
    images: data.images || [],
    video: data.video,
    visibility: data.visibility || 'public',
    groupId: data.groupId,
    tags: data.tags || [],
    mentions: data.mentions || [],
    lessonId: data.lessonId,
    challengeId: data.challengeId,
  })

  const author = await User.findById(userId).select('name avatar level totalXp')
  return new PostDetailDTO(post, author)
}

/**
 * Update a post
 */
export const updatePost = async (userId, postId, data) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  if (post.authorId.toString() !== userId) throw new Error('FORBIDDEN')

  if (data.content !== undefined) post.content = data.content
  if (data.images !== undefined) post.images = data.images
  if (data.video !== undefined) post.video = data.video
  if (data.visibility !== undefined) post.visibility = data.visibility
  if (data.tags !== undefined) post.tags = data.tags
  await post.save()

  const author = await User.findById(userId).select('name avatar level totalXp')
  return new PostDetailDTO(post, author)
}

/**
 * Delete a post (soft delete)
 */
export const deletePost = async (userId, postId) => {
  const post = await Post.findById(postId)
  if (!post) throw new Error('POST_NOT_FOUND')
  if (post.authorId.toString() !== userId) throw new Error('FORBIDDEN')
  post.status = 'deleted'
  await post.save()
  return true
}

/**
 * Like/Unlike a post
 */
export const toggleLike = async (userId, postId) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')

  const existingLike = await PostLike.findOne({ postId, userId })
  if (existingLike) {
    await PostLike.deleteOne({ _id: existingLike._id })
    await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } })
    return { liked: false }
  } else {
    await PostLike.create({ postId, userId })
    await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } })
    return { liked: true }
  }
}

/**
 * Check if user liked a post
 */
export const checkLiked = async (userId, postId) => {
  const like = await PostLike.findOne({ postId, userId })
  return { liked: !!like }
}

/**
 * Get comments for a post
 */
export const getComments = async (postId, { parentId, page = 1, limit = 20 }) => {
  const filter = { postId, status: 'active' }
  if (parentId) {
    filter.parentId = parentId
  } else {
    filter.parentId = { $eq: null }
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Comment.countDocuments(filter)
  const comments = await Comment.find(filter)
    .populate('authorId', 'name avatar level totalXp')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(perPage)

  return {
    comments: comments.map(c => new CommentDetailDTO(c, c.authorId)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Create a comment
 */
export const createComment = async (userId, postId, { content, parentId }) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')

  const comment = await Comment.create({
    postId,
    authorId: userId,
    content,
    parentId: parentId || null,
  })

  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } })
  if (parentId) {
    await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } })
  }

  const author = await User.findById(userId).select('name avatar level totalXp')
  return new CommentDetailDTO(comment, author)
}

/**
 * Delete a comment
 */
export const deleteComment = async (userId, commentId) => {
  const comment = await Comment.findById(commentId)
  if (!comment) throw new Error('COMMENT_NOT_FOUND')
  if (comment.authorId.toString() !== userId) throw new Error('FORBIDDEN')

  comment.status = 'deleted'
  await comment.save()
  await Post.findByIdAndUpdate(comment.postId, { $inc: { commentCount: -1 } })
  return true
}
