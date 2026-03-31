import { User, UserGameStats, UserSkillStats } from '../models/index.js'

/**
 * Lấy hồ sơ năng lực của người dùng để nạp vào AI Matchmaking.
 * @param {string} userId
 * @param {number} partySize
 */
export const getMatchmakingProfile = async (userId, partySize) => {
  // 1. Lấy Level (L)
  const user = await User.findById(userId).select('level').lean()
  const level = user?.level || 1

  // 2. Lấy Played count (P) và Success count (S) từ UserGameStats theo partySize
  const gameStats = await UserGameStats.findOne({ userId, gameKey: 'word-scramble' }).lean()
  let P = 0
  let S = 0
  if (gameStats) {
    const sizeStat = gameStats.statsByPartySize?.find(s => s.partySize === partySize)
    if (sizeStat) {
      P = sizeStat.playedCount || 0
      S = sizeStat.winCount || 0
    }
  }

  // 3. Lấy Skill Stats (Reading - R, Listening/Nature - N, Writing - W)
  const skillStats = await UserSkillStats.find({ userId }).lean()
  
  const getStatsFor = (skillName) => {
    const s = skillStats.find(item => item.skill === skillName)
    return {
      score: s?.averageScore || 50,
      totalTime: s?.totalTimeSpent || 0.3833333333333333,
      weeklyTime: s?.weeklyTimeSpent || 0.3833333333333333,
      dailyTime: s?.dailyTimeSpent || 0.3833333333333333,
    }
  }

  const R = getStatsFor('reading')
  const N = getStatsFor('listening') // Giả định 'listening' tương ứng với 'Nature' trong AI data
  const W = getStatsFor('writing')

  return {
    entityId: userId.toString(),
    users: [
      {
        userId: userId.toString(),
        stats: {
          L: level,
          P,
          S,
          R_score: R.score, R_totalTime: R.totalTime, R_weeklyTime: R.weeklyTime, R_dailyTime: R.dailyTime,
          N_score: N.score, N_totalTime: N.totalTime, N_weeklyTime: N.weeklyTime, N_dailyTime: N.dailyTime,
          W_score: W.score, W_totalTime: W.totalTime, W_weeklyTime: W.weeklyTime, W_dailyTime: W.dailyTime,
        }
      }
    ]
  }
}

/**
 * Gọi AI Matchmaking để tìm nhóm phù hợp.
 * @param {string} hostId
 * @param {string[]} queueUserIds
 * @param {number} partySize
 */
export const callMatchmakingAI = async (hostId, queueUserIds, partySize) => {
  const hostProfile = await getMatchmakingProfile(hostId, partySize)
  
  const queueProfiles = await Promise.all(
    queueUserIds.map(uid => getMatchmakingProfile(uid, partySize))
  )

  const payload = {
    partySize,
    host: {
      ...hostProfile,
      type: 'solo', // Mặc định là solo host
    },
    queue: queueProfiles.map(p => ({
      ...p,
      type: 'solo',
    }))
  }

  try {
    const aiUrl = process.env.AI_MATCHMAKING_URL
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('AI Matchmaking Error:', errorData)
      throw new Error('AI_MATCHMAKING_FAILED')
    }
    return await response.json()
  } catch (error) {
    console.error('AI Matchmaking Connection Error:', error.message)
    throw new Error('AI_MATCHMAKING_FAILED')
  }
}
