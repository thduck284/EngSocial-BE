import { BaseDTO } from '../../base.dto.js'
import { UserProfileDTO } from '../../auth/response/user.response.js'

export class FriendshipDTO extends BaseDTO {
  constructor(friendship) {
    super({
      id: friendship._id?.toString() || friendship.id,
      userId: friendship.userId?.toString(),
      friendId: friendship.friendId?.toString(),
      status: friendship.status,
      requestedBy: friendship.requestedBy?.toString(),
      acceptedAt: friendship.acceptedAt,
      createdAt: friendship.createdAt,
      updatedAt: friendship.updatedAt,
    })
  }
}

export class GroupDTO extends BaseDTO {
  constructor(group) {
    super({
      id: group._id?.toString() || group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      icon: group.icon,
      coverImage: group.coverImage,
      color: group.color,
      type: group.type,
      category: group.category,
      memberCount: group.memberCount,
      postCount: group.postCount,
      rules: group.rules,
      status: group.status,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    })
  }
}

export class GroupMemberDTO extends BaseDTO {
  constructor(member) {
    super({
      id: member._id?.toString() || member.id,
      groupId: member.groupId?.toString(),
      userId: member.userId?.toString(),
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
    })
  }
}

/** Map mentions to { id, name?, avatar? } for display (populated or plain id) */
function mapMentions(mentions, mentionSnapshots) {
  if (!Array.isArray(mentions)) return []
  const byId =
    Array.isArray(mentionSnapshots) && mentionSnapshots.length
      ? new Map(
          mentionSnapshots
            .map((s) =>
              s && (s.userId || s.id)
                ? [s.userId?.toString?.() || s.id?.toString?.(), s]
                : null
            )
            .filter(Boolean)
        )
      : null

  return mentions.map((m) => {
    if (m && typeof m === 'object' && (m._id || m.id)) {
      const id = (m._id || m.id).toString()
      const snap = byId ? byId.get(id) : null
      return {
        id,
        name: m.name || snap?.name,
        avatar: m.avatar || snap?.avatar,
      }
    }
    const id = m?.toString?.() || m
    const snap = byId ? byId.get(id) : null
    return { id, name: snap?.name, avatar: snap?.avatar }
  })
}

/** Normalize documents to [{ url, name }] for API (legacy: string -> { url, name: '' }) */
function mapDocuments(docs) {
  if (!Array.isArray(docs)) return []
  return docs.map((d) => {
    if (typeof d === 'string') return { url: d, name: '' }
    if (d && typeof d === 'object' && d.url) return { url: d.url, name: d.name || '' }
    return { url: '', name: '' }
  })
}

export class PostDTO extends BaseDTO {
  constructor(post) {
    super({
      id: post._id?.toString() || post.id,
      authorId: post.authorId?.toString(),
      groupId: post.groupId?.toString(),
      content: post.content,
      images: post.images,
      video: post.video,
      documents: mapDocuments(post.documents),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      lessonId: post.lessonId?.toString(),
      challengeId: post.challengeId?.toString(),
      visibility: post.visibility,
      status: post.status,
      tags: post.tags,
      mentions: mapMentions(post.mentions, post.mentionSnapshots),
      sharedPostId: post.sharedPostId?.toString(),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    })
  }
}

export class PostDetailDTO extends BaseDTO {
  constructor(post, author) {
    super({
      id: post._id?.toString() || post.id,
      author: author ? new UserProfileDTO(author) : null,
      groupId: post.groupId?.toString(),
      content: post.content,
      images: post.images,
      video: post.video,
      documents: mapDocuments(post.documents),
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      lessonId: post.lessonId?.toString(),
      challengeId: post.challengeId?.toString(),
      visibility: post.visibility,
      status: post.status,
      tags: post.tags,
      mentions: mapMentions(post.mentions, post.mentionSnapshots),
      // When this is a reshare, embed a lightweight version of the original post
      sharedPost: post.sharedPostId
        ? new PostDetailDTO(
            post.sharedPostId,
            post.sharedPostId.authorId || post.sharedPostId.author
          )
        : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    })
  }
}

export class CommentDTO extends BaseDTO {
  constructor(comment) {
    super({
      id: comment._id?.toString() || comment.id,
      postId: comment.postId?.toString(),
      authorId: comment.authorId?.toString(),
      parentId: comment.parentId?.toString(),
      content: comment.content,
      images: Array.isArray(comment.images) ? comment.images : [],
      video: comment.video || null,
      audio: comment.audio || null,
      documents: mapDocuments(comment.documents),
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })
  }
}

export class CommentDetailDTO extends BaseDTO {
  constructor(comment, author) {
    super({
      id: comment._id?.toString() || comment.id,
      postId: comment.postId?.toString(),
      author: author ? new UserProfileDTO(author) : null,
      parentId: comment.parentId?.toString(),
      content: comment.content,
      images: Array.isArray(comment.images) ? comment.images : [],
      video: comment.video || null,
      audio: comment.audio || null,
      documents: mapDocuments(comment.documents),
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })
  }
}
