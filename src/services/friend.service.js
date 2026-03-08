import { Friendship, User } from '../models/index.js'
import { FriendshipDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Send friend request
 */
export const sendFriendRequest = async (userId, friendId) => {
  if (userId === friendId) throw new Error('CANNOT_ADD_SELF')

  const friend = await User.findById(friendId)
  if (!friend) throw new Error('USER_NOT_FOUND')

  // Check existing friendship in both directions
  const existing = await Friendship.findOne({
    $or: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
  })
  if (existing) {
    if (existing.status === 'blocked') throw new Error('USER_BLOCKED')
    if (existing.status === 'pending') throw new Error('REQUEST_ALREADY_SENT')
    if (existing.status === 'accepted') throw new Error('ALREADY_FRIENDS')
  }

  const friendship = await Friendship.create({
    userId,
    friendId,
    status: 'pending',
    requestedBy: userId,
  })
  return new FriendshipDTO(friendship)
}

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (userId, friendshipId) => {
  const friendship = await Friendship.findById(friendshipId)
  if (!friendship) throw new Error('REQUEST_NOT_FOUND')
  if (friendship.friendId.toString() !== userId) throw new Error('FORBIDDEN')
  if (friendship.status !== 'pending') throw new Error('REQUEST_NOT_PENDING')

  friendship.status = 'accepted'
  friendship.acceptedAt = new Date()
  await friendship.save()
  return new FriendshipDTO(friendship)
}

/**
 * Reject / cancel friend request
 */
export const rejectFriendRequest = async (userId, friendshipId) => {
  const friendship = await Friendship.findById(friendshipId)
  if (!friendship) throw new Error('REQUEST_NOT_FOUND')
  if (friendship.friendId.toString() !== userId && friendship.userId.toString() !== userId) {
    throw new Error('FORBIDDEN')
  }
  await Friendship.deleteOne({ _id: friendshipId })
  return true
}

/**
 * Remove friend
 */
export const removeFriend = async (userId, friendId) => {
  const friendship = await Friendship.findOne({
    $or: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
    status: 'accepted',
  })
  if (!friendship) throw new Error('NOT_FRIENDS')
  await Friendship.deleteOne({ _id: friendship._id })
  return true
}

/**
 * Get friends list
 */
export const getFriends = async (userId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })

  const filter = {
    $or: [{ userId }, { friendId: userId }],
    status: 'accepted',
  }
  const total = await Friendship.countDocuments(filter)
  const friendships = await Friendship.find(filter)
    .populate('userId', 'name avatar level totalXp lastActiveDate')
    .populate('friendId', 'name avatar level totalXp lastActiveDate')
    .sort({ acceptedAt: -1 })
    .skip(skip)
    .limit(perPage)

  const friends = friendships.map(f => {
    const friendUser = f.userId._id.toString() === userId ? f.friendId : f.userId
    return {
      friendshipId: f._id.toString(),
      user: {
        id: friendUser._id.toString(),
        name: friendUser.name,
        avatar: friendUser.avatar,
        level: friendUser.level,
        totalXp: friendUser.totalXp,
        lastActiveDate: friendUser.lastActiveDate,
      },
      acceptedAt: f.acceptedAt,
    }
  })

  return { friends, pagination: getPagination({ page, limit: perPage, total }) }
}

/**
 * Get pending friend requests (received)
 */
export const getPendingRequests = async (userId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const filter = { friendId: userId, status: 'pending' }
  const total = await Friendship.countDocuments(filter)
  const requests = await Friendship.find(filter)
    .populate('userId', 'name avatar level totalXp')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    requests: requests.map(r => ({
      friendshipId: r._id.toString(),
      from: {
        id: r.userId._id.toString(),
        name: r.userId.name,
        avatar: r.userId.avatar,
        level: r.userId.level,
      },
      createdAt: r.createdAt,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get sent friend requests
 */
export const getSentRequests = async (userId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const filter = { userId, status: 'pending' }
  const total = await Friendship.countDocuments(filter)
  const requests = await Friendship.find(filter)
    .populate('friendId', 'name avatar level totalXp')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    requests: requests.map(r => ({
      friendshipId: r._id.toString(),
      to: {
        id: r.friendId._id.toString(),
        name: r.friendId.name,
        avatar: r.friendId.avatar,
        level: r.friendId.level,
      },
      createdAt: r.createdAt,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}
