import mongoose from 'mongoose'
import { Post, PostReaction, Comment, User } from '../models/index.js'
import { PostDTO, PostDetailDTO, CommentDTO, CommentDetailDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/** Extract unique hashtag strings from content (without #) */
function extractHashtags(content) {
  if (!content || typeof content !== 'string') return []
  const matches = content.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}

/** Normalize mention IDs to ObjectIds, validate existence, return array */
async function normalizeMentionIds(mentionIds) {
  if (!Array.isArray(mentionIds) || mentionIds.length === 0) return []
  const ids = mentionIds.filter(Boolean).map((id) => (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null)).filter(Boolean)
  const users = await User.find({ _id: { $in: ids } }).select('_id').lean()
  const validIds = users.map((u) => u._id)
  return validIds
}

/** Normalize documents to [{ url, name }] for storage (accepts string or object) */
function normalizeDocuments(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return []
  return docs.map((d) => {
    if (typeof d === 'string') return { url: d, name: '' }
    if (d && typeof d === 'object' && d.url) return { url: d.url, name: (d.name && String(d.name).slice(0, 255)) || '' }
    return null
  }).filter(Boolean)
}

/**
 * Get posts feed. Only filter by visibility when viewing someone else's posts (authorId present and authorId !== viewerId).
 * Own feed or own profile: show all active. Other user's profile: only their public posts.
 */
export const getPosts = async ({ visibility, groupId, authorId, search, page = 1, limit = 10, viewerId }) => {
  const filter = { status: 'active' }
  const isViewingOthers = authorId && viewerId && String(authorId) !== String(viewerId)
  if (isViewingOthers) {
    filter.visibility = 'public'
  } else if (visibility != null && visibility !== '') {
    filter.visibility = visibility
  }
  if (groupId) filter.groupId = groupId
  if (authorId) filter.authorId = authorId
  if (search) filter.$text = { $search: search }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Post.countDocuments(filter)
  const posts = await Post.find(filter)
    .populate('authorId', 'name avatar level totalXp')
    .populate('mentions', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  // If viewer is logged in, attach liked + userReaction per post from PostReaction
  let reactionMap = new Map()
  if (viewerId && posts.length > 0) {
    const postIds = posts.map((p) => p._id)
    const reactions = await PostReaction.find({ postId: { $in: postIds }, userId: viewerId }).select('postId reaction').lean()
    reactionMap = new Map(reactions.map((r) => [r.postId?.toString(), r.reaction]).filter(([id]) => id))
  }

  // Aggregate reaction counts per post (which types: like, love, haha, ...) for display
  let reactionCountsMap = new Map()
  if (posts.length > 0) {
    const postIds = posts.map((p) => p._id)
    const counts = await PostReaction.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: { postId: '$postId', reaction: '$reaction' }, count: { $sum: 1 } } },
    ])
    counts.forEach(({ _id, count }) => {
      const pid = _id.postId?.toString()
      if (!pid) return
      if (!reactionCountsMap.has(pid)) reactionCountsMap.set(pid, {})
      reactionCountsMap.get(pid)[_id.reaction] = count
    })
  }

  const postDTOs = posts.map((p) => {
    const dto = new PostDetailDTO(p, p.authorId)
    const userReaction = viewerId ? reactionMap.get(p._id?.toString()) || null : null
    const reactionCounts = reactionCountsMap.get(p._id?.toString()) || {}
    return { ...dto, liked: !!userReaction, userReaction, reactionCounts }
  })
  return {
    posts: postDTOs,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get single post detail. Optionally include liked for viewerId.
 */
export const getPostById = async (postId, viewerId = null) => {
  const post = await Post.findById(postId)
    .populate('authorId', 'name avatar level totalXp')
    .populate('mentions', 'name avatar')
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  const dto = new PostDetailDTO(post, post.authorId)
  const reactionCountsArr = await PostReaction.aggregate([
    { $match: { postId: post._id } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ])
  const reactionCounts = reactionCountsArr.reduce((acc, { _id, count }) => {
    acc[_id] = count
    return acc
  }, {})
  if (!viewerId) return { ...dto, reactionCounts }
  const reaction = await PostReaction.findOne({ postId, userId: viewerId }).select('reaction').lean()
  const userReaction = reaction?.reaction || null
  return { ...dto, liked: !!userReaction, userReaction, reactionCounts }
}

/**
 * Get document url and name for a post at given index (for download proxy).
 */
export const getPostDocument = async (postId, index) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  const docs = normalizeDocuments(post.documents || [])
  const i = parseInt(index, 10)
  if (Number.isNaN(i) || i < 0 || i >= docs.length) throw new Error('DOCUMENT_NOT_FOUND')
  const d = docs[i]
  return { url: d.url, name: d.name || '' }
}

/**
 * Create a post (parses hashtags from content if tags not provided; normalizes mentions to valid user IDs).
 * content is stored as-is including @mention text (e.g. "Hello @John Doe"); mentions array holds user IDs for refs.
 */
export const createPost = async (userId, data) => {
  const tags = Array.isArray(data.tags) && data.tags.length > 0
    ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : extractHashtags(data.content)
  const mentionIds = await normalizeMentionIds(data.mentions || [])

  const post = await Post.create({
    authorId: userId,
    content: data.content, // full content with @mentions, not stripped
    images: data.images || [],
    video: data.video,
    documents: normalizeDocuments(data.documents || []),
    visibility: data.visibility || 'public',
    groupId: data.groupId,
    tags,
    mentions: mentionIds,
    lessonId: data.lessonId,
    challengeId: data.challengeId,
  })

  const author = await User.findById(userId).select('name avatar level totalXp')
  const populated = await Post.findById(post._id).populate('mentions', 'name avatar').lean()
  return new PostDetailDTO({ ...post.toObject(), mentions: populated?.mentions ?? post.mentions }, author)
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
  if (data.documents !== undefined) post.documents = normalizeDocuments(data.documents)
  if (data.visibility !== undefined) post.visibility = data.visibility
  if (data.tags !== undefined) {
    post.tags = data.tags
  } else if (data.content !== undefined) {
    // Sync hashtags from content when content is updated and tags not provided
    post.tags = extractHashtags(data.content)
  }
  if (data.mentions !== undefined) {
    post.mentions = await normalizeMentionIds(data.mentions)
  }
  await post.save()

  const author = await User.findById(userId).select('name avatar level totalXp')
  const populated = await Post.findById(post._id).populate('mentions', 'name avatar').lean()
  return new PostDetailDTO({ ...post.toObject(), mentions: populated?.mentions ?? post.mentions }, author)
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
 * Set or remove post reaction (6 types: like, love, haha, wow, sad, angry).
 * If same reaction: remove (toggle off). If different: update. If new: add.
 * Returns likeCount and reactionCounts so frontend can show actual reaction types.
 */
async function getReactionCountsForPost(postId) {
  const counts = await PostReaction.aggregate([
    { $match: { postId: postId instanceof mongoose.Types.ObjectId ? postId : new mongoose.Types.ObjectId(postId) } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ])
  return counts.reduce((acc, { _id, count }) => {
    acc[_id] = count
    return acc
  }, {})
}

export const setReaction = async (userId, postId, reaction) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')

  const existing = await PostReaction.findOne({ postId, userId })
  if (existing) {
    if (existing.reaction === reaction) {
      await PostReaction.deleteOne({ _id: existing._id })
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } })
      const updated = await Post.findById(postId).select('likeCount').lean()
      const reactionCounts = await getReactionCountsForPost(postId)
      return { liked: false, userReaction: null, likeCount: updated?.likeCount ?? 0, reactionCounts }
    }
    existing.reaction = reaction
    await existing.save()
    const updated = await Post.findById(postId).select('likeCount').lean()
    const reactionCounts = await getReactionCountsForPost(postId)
    return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
  }
  await PostReaction.create({ postId, userId, reaction })
  await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } })
  const updated = await Post.findById(postId).select('likeCount').lean()
  const reactionCounts = await getReactionCountsForPost(postId)
  return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
}

/**
 * Like/Unlike a post (legacy endpoint: toggles "like"). Prefer setReaction for 6 reaction types.
 */
export const toggleLike = async (userId, postId) => {
  const existing = await PostReaction.findOne({ postId, userId })
  if (existing) {
    if (existing.reaction === 'like') {
      await PostReaction.deleteOne({ _id: existing._id })
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } })
      return { liked: false, userReaction: null }
    }
    existing.reaction = 'like'
    await existing.save()
    return { liked: true, userReaction: 'like' }
  }
  await PostReaction.create({ postId, userId, reaction: 'like' })
  await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } })
  return { liked: true, userReaction: 'like' }
}

/**
 * Check if user reacted to a post; returns liked and userReaction.
 */
export const checkLiked = async (userId, postId) => {
  const r = await PostReaction.findOne({ postId, userId }).select('reaction').lean()
  return { liked: !!r, userReaction: r?.reaction || null }
}

/**
 * Get list of reactions for a post (for modal: who reacted and with which type).
 * Returns reactionCounts and reactions array with user info.
 */
export const getPostReactions = async (postId) => {
  const post = await Post.findById(postId).select('_id status').lean()
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  const raw = await PostReaction.find({ postId })
    .populate('userId', 'name avatar')
    .select('reaction userId')
    .lean()
  const reactionCounts = raw.reduce((acc, r) => {
    const type = r.reaction
    if (type) acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  const reactions = raw.map((r) => ({
    userId: r.userId?._id?.toString(),
    name: r.userId?.name,
    avatar: r.userId?.avatar,
    reaction: r.reaction,
  }))
  return { reactionCounts, reactions }
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
