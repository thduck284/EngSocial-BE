import mongoose from 'mongoose'
import { Post, Reaction, Comment, User, Friendship } from '../models/index.js'
import { PostDTO, PostDetailDTO, CommentDTO, CommentDetailDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import * as notificationService from './notification.service.js'
import { incrementPeriodicQuestsForCategory } from './userPeriodicQuest.service.js'
import { emitToUser } from '../config/socket.js'
import { checkAndThrowIfViolation } from './moderation.service.js'
import { getBlockSets, hiddenUserObjectIds, isHiddenUser, assertCanViewUserContent, filterHiddenById } from '../utils/blockFilter.js'

async function assertPostVisibleToViewer(postId, viewerId) {
  const post = await Post.findById(postId).select('authorId status').lean()
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  if (viewerId) {
    await assertCanViewUserContent(viewerId, post.authorId, 'POST_NOT_FOUND')
  }
  return post
}

/** Extract unique hashtag strings from content (without #) */
function extractHashtags(content) {
  if (!content || typeof content !== 'string') return []
  const matches = content.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}

/** Normalize mention IDs to ObjectIds, validate existence, return array + snapshot */
async function normalizeMentionIds(mentionIds) {
  if (!Array.isArray(mentionIds) || mentionIds.length === 0) {
    return { ids: [], snapshots: [] }
  }
  const ids = mentionIds
    .filter(Boolean)
    .map((id) =>
      typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null
    )
    .filter(Boolean)
  if (ids.length === 0) return { ids: [], snapshots: [] }

  const users = await User.find({ _id: { $in: ids } })
    .select('_id name avatar')
    .lean()
  const validIds = users.map((u) => u._id)
  const snapshots = users.map((u) => ({
    userId: u._id,
    name: u.name,
    avatar: u.avatar,
  }))
  return { ids: validIds, snapshots }
}

/** Notify users who are mentioned in a post */
async function notifyPostMentions(io, post, author) {
  if (!io || !Array.isArray(post.mentions) || post.mentions.length === 0) return
  const authorName = author?.name || 'Ai đó'
  const postId = post._id?.toString() || post.id
  for (const mId of post.mentions) {
    const mentionUserId = mId?.userId || mId
    if (String(mentionUserId) === String(author._id)) continue
    const notification = await notificationService.createNotification({
      userId: mentionUserId,
      type: 'post_mention',
      title: 'Nhắc đến bạn',
      message: `${authorName} đã nhắc đến bạn trong một bài viết`,
      fromUserId: author._id,
      relatedId: postId,
      relatedType: 'post',
      data: { postId, userName: authorName },
    })
    emitToUser(io, mentionUserId, 'notification', notification)
  }
}

/** Notify original author that their post was shared */
async function notifyPostShared(io, sharedPostId, sharer) {
  if (!io || !sharedPostId) return
  const sharedPost = await Post.findById(sharedPostId).select('authorId').lean()
  if (!sharedPost || String(sharedPost.authorId) === String(sharer._id)) return
  const sharerName = sharer?.name || 'Ai đó'
  const postAuthorId = sharedPost.authorId
  const notification = await notificationService.createNotification({
    userId: postAuthorId,
    type: 'post_shared',
    title: 'Bài viết của bạn đã được chia sẻ',
    message: `${sharerName} đã chia sẻ bài viết của bạn`,
    fromUserId: sharer._id,
    relatedId: sharedPostId,
    relatedType: 'post',
    data: { postId: sharedPostId, userName: sharerName },
  })
  emitToUser(io, postAuthorId, 'notification', notification)
}

/** Notify post author that someone commented */
async function notifyPostComment(io, post, comment, author) {
  if (!io || !post || !comment || !author) return
  if (String(post.authorId) === String(author._id)) return
  const authorName = author?.name || 'Ai đó'
  const postId = post._id?.toString() || post.id
  const notification = await notificationService.createNotification({
    userId: post.authorId,
    type: 'comment',
    title: 'Bình luận mới',
    message: `${authorName} đã bình luận vào bài viết của bạn`,
    fromUserId: author._id,
    relatedId: postId,
    relatedType: 'post',
    data: { postId, userName: authorName },
  })
  emitToUser(io, post.authorId, 'notification', notification)
}

/** Notify parent comment author that someone replied */
async function notifyCommentReply(io, parentId, comment, author) {
  if (!io || !parentId || !comment || !author) return
  const parent = await Comment.findById(parentId).select('authorId').lean()
  if (!parent || String(parent.authorId) === String(author._id)) return
  const authorName = author?.name || 'Ai đó'
  const postId = comment.postId?.toString()
  const notification = await notificationService.createNotification({
    userId: parent.authorId,
    type: 'comment',
    title: 'Phản hồi mới',
    message: `${authorName} đã phản hồi bình luận của bạn`,
    fromUserId: author._id,
    relatedId: postId,
    relatedType: 'post',
    data: { postId, userName: authorName },
  })
  emitToUser(io, parent.authorId, 'notification', notification)
}

/** Notify post author that someone reacted */
async function notifyPostReaction(io, post, reactor, reaction) {
  if (!io || !post || !reactor || !reaction) return
  if (String(post.authorId) === String(reactor._id)) return
  const reactorName = reactor?.name || 'Ai đó'
  const postId = post._id?.toString() || post.id
  const notification = await notificationService.createNotification({
    userId: post.authorId,
    type: 'like',
    title: 'Tương tác mới',
    message: `${reactorName} đã bày tỏ cảm xúc với bài viết của bạn`,
    fromUserId: reactor._id,
    relatedId: postId,
    relatedType: 'post',
    data: { postId, userName: reactorName, reaction },
  })
  emitToUser(io, post.authorId, 'notification', notification)
}

/** Notify comment author that someone reacted */
async function notifyCommentReaction(io, comment, reactor, reaction) {
  if (!io || !comment || !reactor || !reaction) return
  if (String(comment.authorId) === String(reactor._id)) return
  const reactorName = reactor?.name || 'Ai đó'
  const postId = comment.postId?.toString()
  const notification = await notificationService.createNotification({
    userId: comment.authorId,
    type: 'comment_like',
    title: 'Tương tác bình luận',
    message: `${reactorName} đã thích bình luận của bạn`,
    fromUserId: reactor._id,
    relatedId: postId,
    relatedType: 'post',
    data: { postId, userName: reactorName, reaction },
  })
  emitToUser(io, comment.authorId, 'notification', notification)
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
export const getPosts = async ({ visibility, groupId, authorId, search, page = 1, limit = 10, viewerId, tab }) => {
  const queryFilter = { status: 'active' }
  const isViewingOthers = authorId && viewerId && String(authorId) !== String(viewerId)
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1)

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })

  if (isViewingOthers) {
    try {
      await assertCanViewUserContent(viewerId, authorId, 'POST_NOT_FOUND')
    } catch (e) {
      if (e.message === 'POST_NOT_FOUND') {
        return { posts: [], pagination: getPagination({ page, limit: perPage, total: 0 }) }
      }
      throw e
    }
  }

  // 1. Base Visibility Filtering
  if (isViewingOthers) {
    queryFilter.visibility = 'public'
    queryFilter.authorId = authorId
  } else if (authorId) {
    queryFilter.authorId = authorId
    if (visibility != null && visibility !== '') {
      queryFilter.visibility = visibility
    }
  } else if (groupId) {
    queryFilter.groupId = groupId
    if (visibility != null && visibility !== '') {
      queryFilter.visibility = visibility
    }
  } else {
    if (viewerId) {
      queryFilter.$or = [
        { visibility: 'public' },
        { authorId: viewerId }
      ]
    } else {
      queryFilter.visibility = 'public'
    }
  }

  // 2. Following Tab logic
  if (tab === 'following' && viewerId) {
    const list = await Friendship.find({
      $or: [
        { userId: viewerId, status: { $in: ['pending', 'accepted'] } },
        { friendId: viewerId, status: 'accepted' }
      ]
    }).lean()

    const followingIds = list.map(f => String(f.userId) === String(viewerId) ? f.friendId : f.userId)
    const acceptedFriendIds = list.filter(f => f.status === 'accepted').map(f => String(f.userId) === String(viewerId) ? f.friendId : f.userId)

    if (followingIds.length === 0) {
      queryFilter.authorId = new mongoose.Types.ObjectId()
    } else {
      // We want posts ONLY from people we follow
      queryFilter.authorId = { $in: followingIds }
      // AND we show: public posts (from anyone we follow) 
      // OR friends-only posts (ONLY from accepted friends)
      queryFilter.$or = [
        { visibility: 'public' },
        { visibility: 'friends', authorId: { $in: acceptedFriendIds } }
      ]
    }
  }

  if (search) queryFilter.$text = { $search: search }

  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    const excludeAuthorIds = hiddenUserObjectIds(hiddenIds)
    if (excludeAuthorIds.length) {
      queryFilter.$and = (queryFilter.$and || []).concat([{ authorId: { $nin: excludeAuthorIds } }])
    }
  }

  const total = await Post.countDocuments(queryFilter)

  let posts = []
  const isShuffleTab = tab === 'all' || tab === 'following' || tab === 'popular'

  if (isShuffleTab && total > 0) {
    const pipeline = [{ $match: queryFilter }]

    if (tab === 'popular') {
      // For popular: Filter by this year and sort by interactions before sampling
      // We also consider interaction from any post but preferentially newer ones.
      // But the user asked for "in this year".
      pipeline[0].$match.createdAt = { $gte: currentYearStart }
      
      // Calculate interaction sum for ranking
      pipeline.push({
        $addFields: {
          interactionScore: { $add: ['$likeCount', '$commentCount'] }
        }
      })
      // Sort by score to get the most interactive ones
      pipeline.push({ $sort: { interactionScore: -1 } })
      // Take top 500 to shuffle from
      pipeline.push({ $limit: 500 })
    }

    // Shuffling
    pipeline.push({ $sample: { size: perPage } })

    // Populates using $lookup (simplified, we use Post.populate after)
    // Actually, I'll just use aggregate to find the IDs then find them properly
    // This is more efficient for populating correctly.
    const ids = await Post.aggregate([...pipeline, { $project: { _id: 1 } }])
    const postIds = ids.map(i => i._id)
    
    posts = await Post.find({ _id: { $in: postIds } })
      .populate('authorId', 'name avatar level totalXp')
      .populate('groupId', 'name icon type')
      .populate('mentions', 'name avatar')
      .populate({
        path: 'sharedPostId',
        populate: { path: 'authorId', select: 'name avatar level totalXp' },
      })
  } else {
    // Default (latest first) or Following (fallback)
    posts = await Post.find(queryFilter)
      .populate('authorId', 'name avatar level totalXp')
      .populate('groupId', 'name icon type')
      .populate('mentions', 'name avatar')
      .populate({
        path: 'sharedPostId',
        populate: { path: 'authorId', select: 'name avatar level totalXp' },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
  }

  if (tab === 'all') {
    // Deep populate for aggregation fallback (mentions and sharedPostId)
    // Actually, I'll just use Post.populate on the results.
    await Post.populate(posts, [
      { path: 'authorId', select: 'name avatar level totalXp' },
      { path: 'groupId', select: 'name icon type' },
      { path: 'mentions', select: 'name avatar' },
      {
        path: 'sharedPostId',
        populate: { path: 'authorId', select: 'name avatar level totalXp' },
      }
    ])
  }

  // If viewer is logged in, attach liked + userReaction per post from Reaction
  let reactionMap = new Map()
  if (viewerId && posts.length > 0) {
    const postIds = posts.map((p) => p._id)
    const reactions = await Reaction.find({ targetType: 'post', targetId: { $in: postIds }, userId: viewerId }).select('targetId reaction').lean()
    reactionMap = new Map(reactions.map((r) => [r.targetId?.toString(), r.reaction]).filter(([id]) => id))
  }

  // Aggregate reaction counts per post (which types: like, love, haha, ...) for display
  let reactionCountsMap = new Map()
  if (posts.length > 0) {
    const postIds = posts.map((p) => p._id)
    const counts = await Reaction.aggregate([
      { $match: { targetType: 'post', targetId: { $in: postIds } } },
      { $group: { _id: { targetId: '$targetId', reaction: '$reaction' }, count: { $sum: 1 } } },
    ])
    counts.forEach(({ _id, count }) => {
      const pid = _id.targetId?.toString()
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
  await assertPostVisibleToViewer(postId, viewerId)
  const post = await Post.findById(postId)
    .populate('authorId', 'name avatar level totalXp')
    .populate('groupId', 'name icon type')
    .populate('mentions', 'name avatar')
    .populate({
      path: 'sharedPostId',
      populate: { path: 'authorId', select: 'name avatar level totalXp' },
    })
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  const dto = new PostDetailDTO(post, post.authorId)
  const reactionCountsArr = await Reaction.aggregate([
    { $match: { targetType: 'post', targetId: post._id } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ])
  const reactionCounts = reactionCountsArr.reduce((acc, { _id, count }) => {
    acc[_id] = count
    return acc
  }, {})
  if (!viewerId) return { ...dto, reactionCounts }
  const reaction = await Reaction.findOne({ targetType: 'post', targetId: postId, userId: viewerId }).select('reaction').lean()
  const userReaction = reaction?.reaction || null
  return { ...dto, liked: !!userReaction, userReaction, reactionCounts }
}

/**
 * Get document url and name for a post at given index (for download proxy).
 */
export const getPostDocument = async (postId, index, viewerId = null) => {
  await assertPostVisibleToViewer(postId, viewerId)
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
export const createPost = async (userId, data, io = null) => {
  // ── Kiểm duyệt nội dung trước khi lưu ──────────────────────────────
  let moderationResult = { violationScore: 0, level: 'none', label: 'Không vi phạm', keywords: [] }
  if (data.content && String(data.content).trim()) {
    const res = await checkAndThrowIfViolation(data.content)
    if (res && res.result) {
      moderationResult = res.result
    }
  }
  // ────────────────────────────────────────────────────────────────────

  const tags = Array.isArray(data.tags) && data.tags.length > 0
    ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : extractHashtags(data.content)
  const { ids: mentionIds, snapshots: mentionSnapshots } = await normalizeMentionIds(
    data.mentions || []
  )

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
    mentionSnapshots,
    lessonId: data.lessonId,
    challengeId: data.challengeId,
    sharedPostId: data.sharedPostId || null,
    moderation: moderationResult,
  })

  try {
    await incrementPeriodicQuestsForCategory(userId, 'community_post', 1)
    await incrementPeriodicQuestsForCategory(userId, 'all', 1)
  } catch (e) {
    console.warn('[periodicQuest] community_post bump:', e?.message)
  }

  if (data.sharedPostId) {
    const sid = String(data.sharedPostId).trim()
    if (mongoose.Types.ObjectId.isValid(sid)) {
      await Post.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(sid), status: { $ne: 'deleted' } },
        { $inc: { shareCount: 1 } }
      )
    }
  }

  const author = await User.findById(userId).select('name avatar level totalXp')
  const populated = await Post.findById(post._id)
    .populate('mentions', 'name avatar')
    .populate('groupId', 'name icon type')
    .lean()
  
  // Async notifications
  notifyPostMentions(io, post, author).catch(err => console.error('Notify mentions err:', err))
  if (data.sharedPostId) {
    notifyPostShared(io, data.sharedPostId, author).catch(err => console.error('Notify share err:', err))
  }

  return new PostDetailDTO({ ...post.toObject(), mentions: populated?.mentions ?? post.mentions }, author)
}

/**
 * Update a post
 */
export const updatePost = async (userId, postId, data, io = null) => {
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  if (post.authorId.toString() !== userId) throw new Error('FORBIDDEN')

  if (data.content !== undefined) {
    post.content = data.content
    if (String(data.content).trim()) {
      const res = await checkAndThrowIfViolation(data.content)
      if (res && res.result) {
        post.moderation = res.result
      }
    } else {
      post.moderation = { violationScore: 0, level: 'none', label: 'Không vi phạm', keywords: [] }
    }
  }
  if (data.images !== undefined) post.images = data.images
  if (data.video !== undefined) {
    post.video = typeof data.video === 'string' && data.video.trim() ? data.video.trim() : null
  }
  if (data.documents !== undefined) post.documents = normalizeDocuments(data.documents)
  if (data.visibility !== undefined) post.visibility = data.visibility
  if (data.tags !== undefined) {
    post.tags = data.tags
  } else if (data.content !== undefined) {
    // Sync hashtags from content when content is updated and tags not provided
    post.tags = extractHashtags(data.content)
  }
  if (data.mentions !== undefined) {
    const { ids, snapshots } = await normalizeMentionIds(data.mentions)
    post.mentions = ids
    post.mentionSnapshots = snapshots
  }
  if (data.sharedPostId !== undefined) {
    post.sharedPostId = data.sharedPostId || null
  }
  await post.save()

  const author = await User.findById(userId).select('name avatar level totalXp')
  const populated = await Post.findById(post._id)
    .populate('mentions', 'name avatar')
    .populate('groupId', 'name icon type')
    .lean()

  if (data.mentions !== undefined) {
    notifyPostMentions(io, post, author).catch(err => console.error('Notify mentions update err:', err))
  }

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
  const pid = postId instanceof mongoose.Types.ObjectId ? postId : new mongoose.Types.ObjectId(postId)
  const counts = await Reaction.aggregate([
    { $match: { targetType: 'post', targetId: pid } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ])
  return counts.reduce((acc, { _id, count }) => {
    acc[_id] = count
    return acc
  }, {})
}

export const setReaction = async (userId, postId, reaction, io = null) => {
  await assertPostVisibleToViewer(postId, userId)
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')

  const existing = await Reaction.findOne({ targetType: 'post', targetId: postId, userId })
  if (existing) {
    if (existing.reaction === reaction) {
      await Reaction.deleteOne({ _id: existing._id })
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } })
      const updated = await Post.findById(postId).select('likeCount').lean()
      const reactionCounts = await getReactionCountsForPost(postId)
      return { liked: false, userReaction: null, likeCount: updated?.likeCount ?? 0, reactionCounts }
    }
    existing.reaction = reaction
    await existing.save()
    const updated = await Post.findById(postId).select('likeCount').lean()
    const reactionCounts = await getReactionCountsForPost(postId)

    // Notify post author of the updated reaction
    const reactor = await User.findById(userId).select('name').lean()
    notifyPostReaction(io, post, reactor, reaction).catch(err => console.error('Notify post reaction (update) err:', err))

    return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
  }
  await Reaction.create({ targetType: 'post', targetId: postId, userId, reaction })
  await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } })
  const updated = await Post.findById(postId).select('likeCount').lean()
  const reactionCounts = await getReactionCountsForPost(postId)

  // Notify post author
  const reactor = await User.findById(userId).select('name').lean()
  notifyPostReaction(io, post, reactor, reaction).catch(err => console.error('Notify post reaction err:', err))

  return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
}

/**
 * Like/Unlike a post (legacy endpoint: toggles "like"). Prefer setReaction for 6 reaction types.
 */
export const toggleLike = async (userId, postId, io = null) => {
  await assertPostVisibleToViewer(postId, userId)
  const existing = await Reaction.findOne({ targetType: 'post', targetId: postId, userId })
  if (existing) {
    if (existing.reaction === 'like') {
      await Reaction.deleteOne({ _id: existing._id })
      await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } })
      return { liked: false, userReaction: null }
    }
    existing.reaction = 'like'
    await existing.save()
    return { liked: true, userReaction: 'like' }
  }
  await Reaction.create({ targetType: 'post', targetId: postId, userId, reaction: 'like' })
  await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } })
  
  const post = await Post.findById(postId).select('authorId').lean()
  const reactor = await User.findById(userId).select('name').lean()
  notifyPostReaction(io, post, reactor, 'like').catch(err => console.error('Notify post toggleLike err:', err))

  return { liked: true, userReaction: 'like' }
}

/**
 * Check if user reacted to a post; returns liked and userReaction.
 */
export const checkLiked = async (userId, postId) => {
  const r = await Reaction.findOne({ targetType: 'post', targetId: postId, userId }).select('reaction').lean()
  return { liked: !!r, userReaction: r?.reaction || null }
}

/**
 * Get list of reactions for a post (for modal: who reacted and with which type).
 * Returns reactionCounts and reactions array with user info.
 */
export const getPostReactions = async (postId, viewerId = null) => {
  await assertPostVisibleToViewer(postId, viewerId)
  const post = await Post.findById(postId).select('_id status').lean()
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')
  const raw = await Reaction.find({ targetType: 'post', targetId: postId })
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
  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    return {
      reactionCounts,
      reactions: filterHiddenById(reactions, (r) => r.userId, hiddenIds),
    }
  }
  return { reactionCounts, reactions }
}

/**
 * Get list of reactions for a comment (for modal: who reacted and with which type).
 * Returns reactionCounts and reactions array with user info.
 */
export const getCommentReactions = async (commentId) => {
  const comment = await Comment.findById(commentId).select('_id status').lean()
  if (!comment || comment.status !== 'active') throw new Error('COMMENT_NOT_FOUND')
  const raw = await Reaction.find({ targetType: 'comment', targetId: commentId })
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
export const getComments = async (postId, { parentId, page = 1, limit = 20, viewerId = null }) => {
  await assertPostVisibleToViewer(postId, viewerId)
  const filter = { postId, status: 'active' }
  if (parentId) {
    // Chỉ lấy reply trực tiếp của một comment cụ thể
    filter.parentId = parentId
  }
  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    const excludeAuthorIds = hiddenUserObjectIds(hiddenIds)
    if (excludeAuthorIds.length) filter.authorId = { $nin: excludeAuthorIds }
  }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Comment.countDocuments(filter)
  const comments = await Comment.find(filter)
    .populate('authorId', 'name avatar level totalXp')
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(perPage)

  // Attach liked + userReaction for viewer, and reactionCounts for each comment
  let userReactionMap = new Map()
  if (viewerId && comments.length > 0) {
    const commentIds = comments.map((c) => c._id)
    const reactions = await Reaction.find({ targetType: 'comment', targetId: { $in: commentIds }, userId: viewerId }).select('targetId reaction').lean()
    userReactionMap = new Map(reactions.map((r) => [r.targetId?.toString(), r.reaction]).filter(([id]) => id))
  }
  let reactionCountsMap = new Map()
  if (comments.length > 0) {
    const commentIds = comments.map((c) => c._id)
    const counts = await Reaction.aggregate([
      { $match: { targetType: 'comment', targetId: { $in: commentIds } } },
      { $group: { _id: { targetId: '$targetId', reaction: '$reaction' }, count: { $sum: 1 } } },
    ])
    counts.forEach(({ _id, count }) => {
      const cid = _id.targetId?.toString()
      if (!cid) return
      if (!reactionCountsMap.has(cid)) reactionCountsMap.set(cid, {})
      reactionCountsMap.get(cid)[_id.reaction] = count
    })
  }

  return {
    comments: comments.map((c) => {
      const dto = new CommentDetailDTO(c, c.authorId)
      const ur = viewerId ? userReactionMap.get(c._id?.toString()) || null : null
      const reactionCounts = reactionCountsMap.get(c._id?.toString()) || {}
      return { ...dto, liked: !!ur, userReaction: ur, reactionCounts }
    }),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

async function getReactionCountsForComment(commentId) {
  const cid = commentId instanceof mongoose.Types.ObjectId ? commentId : new mongoose.Types.ObjectId(commentId)
  const counts = await Reaction.aggregate([
    { $match: { targetType: 'comment', targetId: cid } },
    { $group: { _id: '$reaction', count: { $sum: 1 } } },
  ])
  return counts.reduce((acc, { _id, count }) => {
    acc[_id] = count
    return acc
  }, {})
}

export const setCommentReaction = async (userId, commentId, reaction, io = null) => {
  const comment = await Comment.findById(commentId)
  if (!comment || comment.status !== 'active') throw new Error('COMMENT_NOT_FOUND')

  const existing = await Reaction.findOne({ targetType: 'comment', targetId: commentId, userId })
  if (existing) {
    if (existing.reaction === reaction) {
      await Reaction.deleteOne({ _id: existing._id })
      await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } })
      const updated = await Comment.findById(commentId).select('likeCount').lean()
      const reactionCounts = await getReactionCountsForComment(commentId)
      return { liked: false, userReaction: null, likeCount: updated?.likeCount ?? 0, reactionCounts }
    }
    existing.reaction = reaction
    await existing.save()
    const updated = await Comment.findById(commentId).select('likeCount').lean()
    const reactionCounts = await getReactionCountsForComment(commentId)
    
    // Notify comment author of the updated reaction
    const reactor = await User.findById(userId).select('name').lean()
    notifyCommentReaction(io, comment, reactor, reaction).catch(err => console.error('Notify comment reaction (update) err:', err))

    return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
  }
  await Reaction.create({ targetType: 'comment', targetId: commentId, userId, reaction })
  await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: 1 } })
  const updated = await Comment.findById(commentId).select('likeCount').lean()
  const reactionCounts = await getReactionCountsForComment(commentId)

  // Notify comment author
  const reactor = await User.findById(userId).select('name').lean()
  notifyCommentReaction(io, comment, reactor, reaction).catch(err => console.error('Notify comment reaction err:', err))

  return { liked: true, userReaction: reaction, likeCount: updated?.likeCount ?? 0, reactionCounts }
}

/**
 * Create a comment
 */
export const createComment = async (userId, postId, { content, parentId, images, video, audio, documents } = {}, io = null) => {
  await assertPostVisibleToViewer(postId, userId)
  const post = await Post.findById(postId)
  if (!post || post.status === 'deleted') throw new Error('POST_NOT_FOUND')

  const normImages = Array.isArray(images) ? images.filter((u) => typeof u === 'string' && u.trim()).slice(0, 10) : []
  const normVideo = typeof video === 'string' && video.trim() ? video.trim() : null
  const normAudio = typeof audio === 'string' && audio.trim() ? audio.trim() : null
  const normDocs = normalizeDocuments(documents || []).slice(0, 5)
  const safeContent = typeof content === 'string' ? content : ''

  const comment = await Comment.create({
    postId,
    authorId: userId,
    content: safeContent,
    parentId: parentId || null,
    images: normImages,
    video: normVideo,
    audio: normAudio,
    documents: normDocs,
  })

  await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } })
  if (parentId) {
    await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } })
  }

  const author = await User.findById(userId).select('name avatar level totalXp')
  
  // 1. Notify Parent Comment Author (if reply)
  if (parentId) {
    notifyCommentReply(io, parentId, comment, author).catch(err => console.error('Notify comment reply err:', err))
  }

  // 2. Notify Post Author (always, unless they were already notified as parent author or they are the sender)
  const isPostAuthorDifferentFromParent = !parentId || (String(post.authorId) !== String(comment.authorId)) // wait, comment.authorId is userId
  // Actually, I should check against the parent's authorId
  // Let's do it cleaner.
  
  const postAuthorId = String(post.authorId)
  const senderId = String(userId)
  
  // If I am NOT the post author, notify them
  if (postAuthorId !== senderId) {
    // If it's a reply, only notify post author if they aren't the one being replied to (who already got notified)
    let shouldNotifyPostAuthor = true
    if (parentId) {
      const parent = await Comment.findById(parentId).select('authorId').lean()
      if (parent && String(parent.authorId) === postAuthorId) {
        shouldNotifyPostAuthor = false // Already notified via notifyCommentReply
      }
    }
    
    if (shouldNotifyPostAuthor) {
      notifyPostComment(io, post, comment, author).catch(err => console.error('Notify post comment err:', err))
    }
  }

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

/**
 * Get list of unique users who commented on a post
 */
export const getPostCommentUsers = async (postId, viewerId = null) => {
  await assertPostVisibleToViewer(postId, viewerId)
  const comments = await Comment.find({ postId, status: 'active' })
    .select('authorId')
    .populate('authorId', 'name avatar')
    .lean()
  
  const users = []
  const seen = new Set()
  comments.forEach(c => {
    if (!c.authorId) return
    const id = (c.authorId._id || c.authorId).toString()
    if (!seen.has(id)) {
      seen.add(id)
      users.push({
        userId: id,
        name: c.authorId.name,
        avatar: c.authorId.avatar
      })
    }
  })
  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    return filterHiddenById(users, (u) => u.userId, hiddenIds)
  }
  return users
}

/**
 * Get list of unique users who shared a post
 */
export const getPostShareUsers = async (postId, viewerId = null) => {
  await assertPostVisibleToViewer(postId, viewerId)
  const posts = await Post.find({ sharedPostId: postId, status: 'active' })
    .select('authorId')
    .populate('authorId', 'name avatar')
    .lean()
    
  const users = []
  const seen = new Set()
  posts.forEach(p => {
    if (!p.authorId) return
    const id = (p.authorId._id || p.authorId).toString()
    if (!seen.has(id)) {
      seen.add(id)
      users.push({
        userId: id,
        name: p.authorId.name,
        avatar: p.authorId.avatar
      })
    }
  })
  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    return filterHiddenById(users, (u) => u.userId, hiddenIds)
  }
  return users
}
