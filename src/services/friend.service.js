import mongoose from 'mongoose'
import { Friendship, User } from '../models/index.js'
import { FriendshipDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { incrementPeriodicQuestsForCategory } from './userPeriodicQuest.service.js'
import { isElasticsearchEnabled } from '../config/elasticsearch/client.js'
import { searchUserIds } from '../config/elasticsearch/userSearch.service.js'
import { isUserOnline } from '../config/socket.js'

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
  try {
    await incrementPeriodicQuestsForCategory(friendship.userId, 'friends', 1)
    await incrementPeriodicQuestsForCategory(friendship.friendId, 'friends', 1)
  } catch (e) {
    console.warn('[periodicQuest] friends bump:', e?.message)
  }
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
    const fid = friendUser._id.toString()
    return {
      friendshipId: f._id.toString(),
      user: {
        id: fid,
        name: friendUser.name,
        avatar: friendUser.avatar,
        level: friendUser.level,
        totalXp: friendUser.totalXp,
        lastActiveDate: friendUser.lastActiveDate,
        online: isUserOnline(fid), // REAL-TIME CHECK
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

/**
 * Search users for adding friends (by name).
 * @param {string} currentUserId - logged-in user id
 * @param {object} opts - { q, page, limit, friendFilter }
 * @param {string} opts.q - search term (name)
 * @param {string} opts.friendFilter - 'all' | 'connected' | 'pending'
 */
export const searchUsersForFriends = async (currentUserId, { q = '', page = 1, limit = 20, friendFilter = 'all' }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const trimmedQ = (q || '').trim()

  let userIdsFilter = null
  if (friendFilter === 'connected') {
    const accepted = await Friendship.find({
      $or: [{ userId: currentUserId }, { friendId: currentUserId }],
      status: 'accepted',
    }).lean()
    const ids = new Set()
    accepted.forEach(f => {
      const other = f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
      ids.add(other)
    })
    userIdsFilter = Array.from(ids)
    if (userIdsFilter.length === 0) {
      return { users: [], pagination: getPagination({ page, limit: perPage, total: 0 }) }
    }
  } else if (friendFilter === 'pending') {
    const pending = await Friendship.find({
      $or: [{ userId: currentUserId }, { friendId: currentUserId }],
      status: 'pending',
    }).lean()
    const ids = new Set()
    pending.forEach(f => {
      const other = f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
      ids.add(other)
    })
    userIdsFilter = Array.from(ids)
    if (userIdsFilter.length === 0) {
      return { users: [], pagination: getPagination({ page, limit: perPage, total: 0 }) }
    }
  }

  const setFilter = userIdsFilter ? new Set(userIdsFilter) : null

  if (isElasticsearchEnabled()) {
    try {
      const { ids: esIds, total: esTotal } = await searchUserIds(trimmedQ, { from: 0, size: 500 })
      let filteredIds = esIds.filter(
        (id) => id !== currentUserId && (setFilter === null || setFilter.has(id))
      )
      const total = filteredIds.length
      const pageIds = filteredIds.slice(skip, skip + perPage)
      if (pageIds.length === 0) {
        return { users: [], pagination: getPagination({ page, limit: perPage, total }) }
      }
      const users = await User.find({ _id: { $in: pageIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select('name avatar level totalXp')
        .lean()
      const orderMap = new Map(pageIds.map((id, i) => [id, i]))
      users.sort((a, b) => {
        const aId = a._id.toString()
        const bId = b._id.toString()
        return (orderMap.get(aId) ?? 999) - (orderMap.get(bId) ?? 999)
      })
      const userIds = users.map((u) => u._id.toString())
      const friendships = await Friendship.find({
        $or: [
          { userId: currentUserId, friendId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
          { friendId: currentUserId, userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        ],
      }).lean()
      const statusByFriendId = {}
      const friendshipIdByFriendId = {}
      const pendingSentByMeByFriendId = {}
      friendships.forEach((f) => {
        const other = f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
        statusByFriendId[other] = f.status === 'accepted' ? 'connected' : 'pending'
        friendshipIdByFriendId[other] = f._id.toString()
        if (f.status === 'pending') {
          pendingSentByMeByFriendId[other] = f.userId.toString() === currentUserId
        }
      })
      const result = users.map((u) => {
        const uid = u._id.toString()
        const friendStatus = statusByFriendId[uid] || 'none'
        const out = {
          id: uid,
          name: u.name,
          avatar: u.avatar,
          level: u.level,
          totalXp: u.totalXp,
          friendStatus,
          online: isUserOnline(uid),
        }
        if (friendshipIdByFriendId[uid]) out.friendshipId = friendshipIdByFriendId[uid]
        if (friendStatus === 'pending' && pendingSentByMeByFriendId[uid] !== undefined) {
          out.pendingSentByMe = pendingSentByMeByFriendId[uid]
        }
        return out
      })
      return { users: result, pagination: getPagination({ page, limit: perPage, total }) }
    } catch (err) {
      console.warn('Elasticsearch search fallback to MongoDB:', err?.message)
    }
  }

  const userQuery = {}
  if (userIdsFilter?.length) {
    userQuery._id = { $in: userIdsFilter.map((id) => new mongoose.Types.ObjectId(id)) }
  } else {
    userQuery._id = { $ne: new mongoose.Types.ObjectId(currentUserId) }
  }
  if (trimmedQ) {
    userQuery.name = { $regex: trimmedQ, $options: 'i' }
  }

  const total = await User.countDocuments(userQuery)
  const users = await User.find(userQuery)
    .select('name avatar level totalXp')
    .sort({ name: 1 })
    .skip(skip)
    .limit(perPage)
    .lean()

  const userIds = users.map((u) => u._id.toString())
  const friendships = await Friendship.find({
    $or: [
      { userId: currentUserId, friendId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { friendId: currentUserId, userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    ],
  }).lean()

  const statusByFriendId = {}
  const friendshipIdByFriendId = {}
  const pendingSentByMeByFriendId = {}
  friendships.forEach((f) => {
    const other = f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
    statusByFriendId[other] = f.status === 'accepted' ? 'connected' : 'pending'
    friendshipIdByFriendId[other] = f._id.toString()
    if (f.status === 'pending') {
      pendingSentByMeByFriendId[other] = f.userId.toString() === currentUserId
    }
  })

  const result = users.map((u) => {
    const uid = u._id.toString()
    const friendStatus = statusByFriendId[uid] || 'none'
    const out = {
      id: uid,
      name: u.name,
      avatar: u.avatar,
      level: u.level,
      totalXp: u.totalXp,
      friendStatus,
      online: isUserOnline(uid),
    }
    if (friendshipIdByFriendId[uid]) out.friendshipId = friendshipIdByFriendId[uid]
    if (friendStatus === 'pending' && pendingSentByMeByFriendId[uid] !== undefined) {
      out.pendingSentByMe = pendingSentByMeByFriendId[uid]
    }
    return out
  })

  return {
    users: result,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get friend suggestions based on friends of friends (mutual connections).
 * @param {string} userId - current user id
 * @param {object} opts - { limit }
 */
export const getFriendSuggestions = async (currentUserId, { limit = 10 }) => {
  const currentId = new mongoose.Types.ObjectId(currentUserId)

  // 1. Get current user's friends
  const myFriendships = await Friendship.find({
    $or: [{ userId: currentId }, { friendId: currentId }],
    status: 'accepted',
  }).lean()

  const myFriendIds = myFriendships.map(f =>
    f.userId.toString() === currentUserId ? f.friendId : f.userId
  )

  // Get blocked users and users who blocked me
  const currentUserDoc = await User.findById(currentUserId).select('blockedUserIds').lean()
  const myBlockedIds = (currentUserDoc?.blockedUserIds || []).map(id => new mongoose.Types.ObjectId(id.toString()))

  const usersWhoBlockedMe = await User.find({ blockedUserIds: currentId }).select('_id').lean()
  const usersWhoBlockedMeIds = usersWhoBlockedMe.map(u => new mongoose.Types.ObjectId(u._id.toString()))

  const allExcludedIds = [
    currentId,
    ...myFriendIds.map(id => new mongoose.Types.ObjectId(id.toString())),
    ...myBlockedIds,
    ...usersWhoBlockedMeIds
  ]

  // 2. Get all friendships of my friends (second degree)
  // We exclude current user, my existing friends, and blocked users from the suggestion pool.
  const pipeline = [
    {
      $match: {
        $or: [
          { userId: { $in: myFriendIds } },
          { friendId: { $in: myFriendIds } },
        ],
        status: 'accepted',
      },
    },
    {
      $project: {
        // If userId is my friend, then friendId is the potential suggestion
        // If friendId is my friend, then userId is the potential suggestion
        potentialId: {
          $cond: [
            { $in: ['$userId', myFriendIds] },
            '$friendId',
            '$userId',
          ],
        },
      },
    },
    {
      $match: {
        potentialId: {
          $nin: allExcludedIds,
        },
      },
    },
    {
      $group: {
        _id: '$potentialId',
        mutualCount: { $sum: 1 },
      },
    },
    { $sort: { mutualCount: -1 } },
    { $limit: Number(limit) * 3 }, // Get a few more to filter pending requests
  ]

  const rawSuggestions = await Friendship.aggregate(pipeline)

  if (rawSuggestions.length === 0) {
    // If no mutual friends found, fallback to random active users (excluding blocked), limit to 15 users as requested
    const randomUsers = await User.find({
      _id: { $nin: allExcludedIds },
      status: 'active',
    })
      .select('name avatar level totalXp')
      .limit(15)
      .lean()

    return randomUsers.map(u => ({
      id: u._id.toString(),
      name: u.name,
      avatar: u.avatar,
      level: u.level,
      totalXp: u.totalXp,
      mutualFriendsCount: 0,
      online: isUserOnline(u._id.toString()),
    }))
  }

  // 3. Filter out users who have pending requests with me
  const suggestionIds = rawSuggestions.map(s => s._id)
  const pendingFriendships = await Friendship.find({
    $or: [
      { userId: currentId, friendId: { $in: suggestionIds } },
      { friendId: currentId, userId: { $in: suggestionIds } },
    ],
    status: 'pending',
  }).lean()

  const pendingIds = new Set(pendingFriendships.map(f =>
    f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
  ))

  const filteredSuggestions = rawSuggestions
    .filter(s => !pendingIds.has(s._id.toString()))
    .slice(0, Number(limit))

  // 4. Populate user info
  const finalUserIds = filteredSuggestions.map(s => s._id)
  const users = await User.find({ _id: { $in: finalUserIds } })
    .select('name avatar level totalXp')
    .lean()

  const userMap = new Map(users.map(u => [u._id.toString(), u]))

  return filteredSuggestions.map(s => {
    const u = userMap.get(s._id.toString())
    if (!u) return null
    return {
      id: u._id.toString(),
      name: u.name,
      avatar: u.avatar,
      level: u.level,
      totalXp: u.totalXp,
      mutualFriendsCount: s.mutualCount,
      online: isUserOnline(u._id.toString()),
    }
  }).filter(Boolean)
}
