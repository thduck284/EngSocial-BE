import { LeaderboardSnapshot, User } from '../models/index.js'
import { LeaderboardSnapshotDTO } from '../dto/index.js'

/**
 * Get leaderboard by type and period
 */
export const getLeaderboard = async ({ type = 'weekly', period }) => {
  const filter = { type }
  if (period) filter.period = period

  const snapshot = await LeaderboardSnapshot.findOne(filter).sort({ generatedAt: -1 })
  if (snapshot) return new LeaderboardSnapshotDTO(snapshot)

  // If no snapshot exists, generate one from live data
  return await generateLeaderboard(type)
}

/**
 * Generate leaderboard from live user data
 */
export const generateLeaderboard = async (type = 'weekly') => {
  const now = new Date()
  let period

  if (type === 'weekly') {
    const weekNum = getWeekNumber(now)
    period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  } else if (type === 'monthly') {
    period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  } else {
    period = 'all_time'
  }

  const users = await User.find({ status: 'active' })
    .select('name avatar level totalXp xp')
    .sort({ totalXp: -1 })
    .limit(100)

  const entries = users.map((u, idx) => ({
    rank: idx + 1,
    userId: u._id,
    name: u.name,
    avatar: u.avatar,
    xp: u.totalXp || 0,
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
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000))
  return Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7)
}
