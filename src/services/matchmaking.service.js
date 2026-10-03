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
 * @param {any[]} queueEntities Danh sách các thực thể (Solo hoặc Group) đã có profile
 * @param {number} partySize
 * @param {{ hostPartyUserIds?: string[], hostEntityId?: string }} [opts]
 */
export const callMatchmakingAI = async (hostId, queueEntities, partySize, opts = {}) => {
  const hostPartyUserIds = Array.isArray(opts.hostPartyUserIds)
    ? opts.hostPartyUserIds.map(String).filter(Boolean)
    : []
  const hostEntityId = opts.hostEntityId || hostId.toString()

  let hostPayload
  if (hostPartyUserIds.length > 1) {
    const profiles = await Promise.all(
      hostPartyUserIds.map((uid) => getMatchmakingProfile(uid, partySize)),
    )
    hostPayload = {
      entityId: hostEntityId,
      users: profiles.flatMap((p) => p.users),
      type: 'group',
    }
  } else {
    const hostProfile = await getMatchmakingProfile(hostId, partySize)
    hostPayload = {
      ...hostProfile,
      type: 'solo',
    }
  }

  const payload = {
    partySize,
    host: hostPayload,
    queue: queueEntities.map(p => ({
      ...p,
      type: p.users?.length > 1 ? 'group' : 'solo',
    }))
  }

  const rawUrl =
    process.env.AI_MATCHMAKING_URL?.trim() ||
    process.env.AI_MATCHMAKING_INTERNAL_URL?.trim()
  if (!rawUrl) {
    console.error(
      'AI Matchmaking Error: set AI_MATCHMAKING_URL (or AI_MATCHMAKING_INTERNAL_URL) in .env',
    )
    throw new Error('AI_MATCHMAKING_FAILED')
  }

  /** Chuẩn hóa: cho phép chỉ ghi base https://xxx.ngrok-free.app (tự thêm /api/matchmake). */
  const normalizeMatchmakingUrl = (u) => {
    let s = String(u).trim().replace(/\s+/g, '')
    if (!s) return ''
    s = s.replace(/\/+$/, '')
    if (/\/api\/matchmake$/i.test(s)) return s
    return `${s}/api/matchmake`
  }

  const aiUrl = normalizeMatchmakingUrl(rawUrl)

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  // Ngrok free: HTML interstitial / edge 404 — gửi bundle header giống trình duyệt + skip warning.
  if (/ngrok\.(app|io|dev)/i.test(aiUrl)) {
    headers['ngrok-skip-browser-warning'] = '69420'
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  try {
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const rawText = await response.text()
    if (!response.ok) {
      let errorData = {}
      try {
        errorData = rawText ? JSON.parse(rawText) : {}
      } catch {
        errorData = { raw: rawText.slice(0, 500) }
      }
      const isNgrokHtml =
        typeof rawText === 'string' &&
        (rawText.includes('assets.ngrok.com') || rawText.includes('ngrok-free.app'))
      if (isNgrokHtml) {
        console.error(
          'AI Matchmaking (ngrok): tunnel có thể đã tắt hoặc AI_MATCHMAKING_URL sai subdomain.',
          '→ Kiểm tra .env AI_MATCHMAKING_URL (hoặc AI_MATCHMAKING_INTERNAL_URL), tunnel/Render đang chạy, rồi restart npm.',
          { requestedUrl: aiUrl, status: response.status },
        )
      } else {
        console.error('AI Matchmaking Error:', response.status, response.statusText, errorData)
      }
      throw new Error(`AI_MATCHMAKING_HTTP_${response.status}`)
    }
    if (
      typeof rawText === 'string' &&
      rawText.trimStart().startsWith('<!') &&
      (rawText.includes('assets.ngrok.com') || rawText.includes('ngrok'))
    ) {
      console.error(
        'AI Matchmaking (ngrok): nhận HTML thay vì JSON (interstitial / tunnel lỗi). Kiểm tra URL + notebook đang chạy.',
        { requestedUrl: aiUrl },
      )
      throw new Error('AI_MATCHMAKING_NGROK_HTML')
    }
    try {
      return JSON.parse(rawText)
    } catch (e) {
      console.error('AI Matchmaking Error: response is not JSON', rawText.slice(0, 300))
      throw new Error('AI_MATCHMAKING_INVALID_JSON')
    }
  } catch (error) {
    const msg = error?.cause?.message || error.message
    console.error('AI Matchmaking Connection Error:', msg)
    throw new Error('AI_MATCHMAKING_FAILED')
  }
}
