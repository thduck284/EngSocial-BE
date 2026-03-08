import { User, Friendship } from '../models/index.js'

/**
 * Get public profile of a user for viewing by another user.
 * Returns profile + friendStatus, friendsCount, mutualFriendsCount, friends preview.
 */
export const getPublicProfile = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    return null // caller should use getProfile (current user) instead
  }

  const user = await User.findById(targetUserId)
    .select('name avatar bio level xp totalXp createdAt')
    .lean()

  if (!user) return null

  const targetId = user._id.toString()

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

  return {
    id: targetId,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    level: user.level ?? 1,
    xp: user.xp ?? 0,
    totalXp: user.totalXp ?? 0,
    createdAt: user.createdAt,
    friendStatus,
    friendshipId,
    pendingSentByMe,
    friendsCount,
    mutualFriendsCount,
    friends,
  }
}
