import { LeaderboardSnapshot, User, Friendship } from '../models/index.js'
import { LeaderboardSnapshotDTO } from '../dto/index.js'
import { getISOWeekNumber } from './userPeriodicQuest.service.js'

/**
 * Get leaderboard by type and period
 */
export const getLeaderboard = async ({ type = 'weekly', period, userId }) => {
  if (type === 'weekly' && userId) {
    return await generateFriendsLeaderboard(userId, 'weekly')
  }

  const filter = { type }
  if (period) filter.period = period

  const snapshot = await LeaderboardSnapshot.findOne(filter).sort({ generatedAt: -1 })
  if (snapshot) return new LeaderboardSnapshotDTO(snapshot)

  // If no snapshot exists, generate one from live data
  return await generateLeaderboard(type)
}

const generateFriendsLeaderboard = async (userId, type) => {
  const now = new Date()
  
  // Find friends
  const friendships = await Friendship.find({
    $or: [{ userId }, { friendId: userId }],
    status: 'accepted'
  }).lean()
  
  const userIds = friendships.map(f => f.userId.toString() === userId.toString() ? f.friendId : f.userId)
  userIds.push(userId) // include self

  let query = { _id: { $in: userIds }, status: 'active' }
  let sortField = 'totalXp'
  let selectFields = 'name avatar level totalXp xp'

  if (type === 'weekly') {
    const startOfWeek = new Date(now)
    startOfWeek.setHours(0, 0, 0, 0)
    const day = startOfWeek.getDay() || 7 // 1=Mon, 7=Sun
    startOfWeek.setDate(startOfWeek.getDate() - day + 1)
    
    query.lastWeeklyXpReset = { $gte: startOfWeek }
    sortField = 'weeklyXp'
    selectFields = 'name avatar level totalXp weeklyXp xp'
  }

  const users = await User.find(query)
    .select(selectFields)
    .sort({ [sortField]: -1 })
    .limit(100)

  const entries = users.map((u, idx) => ({
    rank: idx + 1,
    userId: u._id,
    name: u.name,
    avatar: u.avatar,
    xp: type === 'weekly' ? (u.weeklyXp || 0) : (u.totalXp || 0),
    level: u.level || 1,
  }))

  return {
    type,
    period: 'dynamic',
    generatedAt: now,
    entries
  }
}

/**
 * Generate leaderboard from live user data
 */
export const generateLeaderboard = async (type = 'weekly') => {
  const now = new Date()
  let period
  let query = { status: 'active' }
  let sortField = 'totalXp'
  let selectFields = 'name avatar level totalXp xp'

  if (type === 'weekly') {
    const { weekNo, year } = getISOWeekNumber(now)
    period = `${year}-W${String(weekNo).padStart(2, '0')}`
    
    // Calculate start of current week (Monday)
    const startOfWeek = new Date(now)
    startOfWeek.setHours(0, 0, 0, 0)
    const day = startOfWeek.getDay() || 7 // 1=Mon, 7=Sun
    startOfWeek.setDate(startOfWeek.getDate() - day + 1)
    
    // Only fetch users who have earned XP this week
    query.lastWeeklyXpReset = { $gte: startOfWeek }
    sortField = 'weeklyXp'
    selectFields = 'name avatar level totalXp weeklyXp xp'
  } else if (type === 'monthly') {
    period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  } else {
    period = 'all_time'
  }

  const users = await User.find(query)
    .select(selectFields)
    .sort({ [sortField]: -1 })
    .limit(100)

  const entries = users.map((u, idx) => ({
    rank: idx + 1,
    userId: u._id,
    name: u.name,
    avatar: u.avatar,
    xp: type === 'weekly' ? (u.weeklyXp || 0) : (u.totalXp || 0),
    level: u.level || 1,
  }))

  const snapshot = await LeaderboardSnapshot.findOneAndUpdate(
    { type, period },
    { type, period, entries, generatedAt: now },
    { upsert: true, new: true },
  )

  return new LeaderboardSnapshotDTO(snapshot)
}

function getWeekNumber(d) {
  const { weekNo } = getISOWeekNumber(d)
  return weekNo
}
