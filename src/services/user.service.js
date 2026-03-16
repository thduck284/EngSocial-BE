import { User, Friendship, UserSkillStats } from '../models/index.js'

const SKILL_LEVEL_NUM = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

/**
 * Get public profile of a user for viewing by another user.
 * Returns profile + friendStatus, friendsCount, mutualFriendsCount, friends preview.
 */
export const getPublicProfile = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    return null // caller should use getProfile (current user) instead
  }

  const user = await User.findById(targetUserId)
    .select('name email avatar bio phone address dateOfBirth gender level xp totalXp createdAt')
    .lean()

  if (!user) return null

  const targetId = user._id.toString()

  // Check if current user has blocked this profile user
  const currentUserDoc = await User.findById(currentUserId).select('blockedUserIds').lean()
  const blockedByMe = (currentUserDoc?.blockedUserIds || []).some((b) => b.toString() === targetId)

  // Friendship between current user and target
  const friendship = await Friendship.findOne({
    $or: [
      { userId: currentUserId, friendId: targetId },
      { userId: targetId, friendId: currentUserId },
    ],
  }).lean()

  let friendStatus = 'none'
  let friendshipId = null
  let pendingSentByMe = false
  if (friendship) {
    friendStatus = friendship.status === 'accepted' ? 'connected' : 'pending'
    friendshipId = friendship._id.toString()
    if (friendship.status === 'pending') {
      pendingSentByMe = friendship.userId.toString() === currentUserId
    }
  }

  // Friends count (accepted) for target user
  const friendsCount = await Friendship.countDocuments({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  })

  // Mutual friends count (users who are friends with both current and target)
  const currentFriends = await Friendship.find({
    $or: [{ userId: currentUserId }, { friendId: currentUserId }],
    status: 'accepted',
  }).lean()
  const currentFriendIds = new Set(
    currentFriends.map((f) =>
      f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
    )
  )
  const targetFriends = await Friendship.find({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  }).lean()
  const targetFriendIds = new Set(
    targetFriends.map((f) =>
      f.userId.toString() === targetId ? f.friendId.toString() : f.userId.toString()
    )
  )
  let mutualFriendsCount = 0
  currentFriendIds.forEach((id) => {
    if (targetFriendIds.has(id)) mutualFriendsCount++
  })

  // First 6 friends of target (for preview)
  const friendDocs = await Friendship.find({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  })
    .populate('userId', 'name avatar')
    .populate('friendId', 'name avatar')
    .limit(6)
    .lean()

  const friends = friendDocs.map((f) => {
    const u = f.userId._id.toString() === targetId ? f.friendId : f.userId
    return {
      id: u._id.toString(),
      name: u.name,
      avatar: u.avatar,
    }
  })

  // Skill stats (reading, listening, writing) for "My skills" block
  const skillStatsDocs = await UserSkillStats.find({ userId: targetId }).lean()
  const skills = (skillStatsDocs || []).map((s) => {
    const totalXp = Number(s.totalXpEarned) || 0
    const level = SKILL_LEVEL_NUM[s.skillLevel] ?? 1
    const percent = Math.min(100, Math.round(totalXp / 50))
    return {
      key: s.skill,
      labelKey: `skills.${s.skill}`,
      level,
      percent,
    }
  })

  return {
    id: targetId,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    phone: user.phone,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    level: user.level ?? 1,
    xp: user.xp ?? 0,
    totalXp: user.totalXp ?? 0,
    createdAt: user.createdAt,
    friendStatus,
    friendshipId,
    pendingSentByMe,
    blockedByMe,
    friendsCount,
    mutualFriendsCount,
    friends,
    skills,
  }
}

/**
 * Chặn user (chat 1-1): thêm targetUserId vào blockedUserIds của current user.
 * Không thể chặn chính mình.
 */
export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) throw new Error('CANNOT_BLOCK_SELF')
  const currentObj = await User.findById(currentUserId).select('blockedUserIds').lean()
  if (!currentObj) throw new Error('USER_NOT_FOUND')
  const targetObj = await User.findById(targetUserId).select('_id').lean()
  if (!targetObj) throw new Error('TARGET_USER_NOT_FOUND')
  const blocked = (currentObj.blockedUserIds || []).map((b) => b.toString())
  if (blocked.includes(targetUserId)) return { blocked: true }
  await User.findByIdAndUpdate(currentUserId, {
    $addToSet: { blockedUserIds: targetObj._id },
  })
  return { blocked: true }
}

/**
 * Bỏ chặn user: xóa targetUserId khỏi blockedUserIds của current user.
 */
export const unblockUser = async (currentUserId, targetUserId) => {
  const currentObj = await User.findById(currentUserId).select('blockedUserIds').lean()
  if (!currentObj) throw new Error('USER_NOT_FOUND')
  await User.findByIdAndUpdate(currentUserId, {
    $pull: { blockedUserIds: targetUserId },
  })
  return { unblocked: true }
}
