import { isUserOnline } from '../config/socket.js'
import { getRandomWord } from '../services/wordScramble.service.js'
import { Game, GameSession, User, UserGameStats } from '../models/index.js'

const roomChannel = (code) => `room:${code}`
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const buildTimedWord = (wordData) => {
  if (!wordData?.word) return null
  const normalized = String(wordData.word).trim()
  const timeLimitSec = Math.max(1, normalized.length * 3 + randomInt(1, 5))
  return { ...wordData, timeLimitSec }
}
const gameTimers = new Map()

const clearRoundTimer = (roomCode) => {
  const timer = gameTimers.get(roomCode)
  if (timer) {
    clearTimeout(timer)
    gameTimers.delete(roomCode)
  }
}

const scheduleRoundTimeout = (io, game) => {
  clearRoundTimer(game.roomCode)
  if (!game?.currentWord?.timeLimitSec || game.status !== 'playing') return
  const roundIdAtSchedule = Number(game.currentRoundId || 0)
  const timer = setTimeout(async () => {
    if (game.status !== 'playing') return
    if (Number(game.currentRoundId || 0) !== roundIdAtSchedule) return

    // Survival logic: If time runs out, everyone currently in the round who hasn't answered is OUT
    // Actually, in this shared word mode, if time runs out, it means NO ONE answered correctly.
    // So everyone who is not already out becomes out.
    game.players.forEach(p => {
      if (!p.isOut) p.isOut = true
    })

    const everyoneOut = game.players.every(p => p.isOut)

    if (everyoneOut) {
      finishGame(io, game, 'all_out', { roundId: roundIdAtSchedule })
    } else {
      // Should not happen in "shared word" mode unless we change how it works.
      // But for robustness: move to next word if there are survivors
      const nextWord = await getRandomWord({ difficulty: game.difficulty || 'medium' })
      if (nextWord) {
        game.currentWord = buildTimedWord(nextWord)
        game.currentRoundId += 1
        scheduleRoundTimeout(io, game)
      }
    }

    io.to(roomChannel(game.roomCode)).emit('wordScrambleGame:update', {
      game,
      lastAction: { type: 'timeout', roundId: roundIdAtSchedule },
    })
  }, Number(game.currentWord.timeLimitSec) * 1000)
  gameTimers.set(game.roomCode, timer)
}

const saveGameResults = async (game) => {
  if (!game || game.players.length === 0) return
  
  try {
    // 1. Find or create the master Game record
    let gameDoc = await Game.findOne({ key: 'word-scramble' })
    if (!gameDoc) {
      gameDoc = await Game.create({
        key: 'word-scramble',
        title: 'Word Scramble',
        titleVi: 'Sắp xếp từ',
        type: 'vocabulary',
        difficulty: 'medium',
        status: 'active',
        config: { xpPerCorrect: 10, streakBonus: true }
      })
    }

    const gameId = gameDoc._id
    const duration = Math.floor((Date.now() - game.startTime) / 1000)
    const partySize = game.players.length

    // 2. Process each player
    for (const p of game.players) {
      if (!p.userId) continue
      
      const xpEarned = p.score // Simple mapping: 1 point = 1 XP (or adjust logic)
      
      // A. Create GameSession
      await GameSession.create({
        gameId,
        userId: p.userId,
        score: p.score,
        correctAnswers: p.correctCount,
        streak: p.maxStreak,
        xpEarned,
        duration,
        partySize,
        endedAt: new Date(),
      })

      // B. Update User Game Stats
      const stats = await UserGameStats.findOneAndUpdate(
        { userId: p.userId, gameKey: 'word-scramble' },
        { 
          $inc: { totalPlayed: 1, totalScore: p.score },
          $set: { lastPlayedAt: new Date() }
        },
        { upsert: true, new: true }
      )

      // Update specific party size stats
      const sizeStatIdx = (stats.statsByPartySize || []).findIndex(s => s.partySize === partySize)
      if (sizeStatIdx >= 0) {
        stats.statsByPartySize[sizeStatIdx].playedCount += 1
        stats.statsByPartySize[sizeStatIdx].totalScore += p.score
      } else {
        if (!stats.statsByPartySize) stats.statsByPartySize = []
        stats.statsByPartySize.push({ partySize, playedCount: 1, totalScore: p.score })
      }
      await stats.save()

      // C. Award XP to User
      const user = await User.findById(p.userId)
      if (user) {
        user.awardXp(xpEarned)
        await user.save()
      }
    }

    // 3. Update global game play count
    await Game.findByIdAndUpdate(gameId, { $inc: { playCount: 1 } })
    
    console.log(`[Game] Saved results for room ${game.roomCode}.`)
  } catch (err) {
    console.error('[Game] Error saving results:', err)
  }
}

// Lưu trữ trạng thái game tạm thời trong RAM (trong sản xuất nên dùng Redis)
// code -> { players: [{userId, name, score, streak}], currentWord: {word, meaning, example}, turnIndex: 0 }
export const activeGames = new Map()
const finishedGames = new Map()

function normalizeRoomCode(code) {
  return String(code || '').trim().toUpperCase()
}

function archiveFinishedGame(game) {
  if (!game?.roomCode) return
  const key = normalizeRoomCode(game.roomCode)
  finishedGames.set(key, {
    roomCode: key,
    players: game.players.map((p) => ({ ...p })),
    status: 'finished',
    difficulty: game.difficulty,
    startTime: game.startTime,
    endTime: game.endTime || Date.now(),
    currentRoundId: game.currentRoundId,
  })
  setTimeout(() => finishedGames.delete(key), 10 * 60 * 1000)
}

function finishGame(io, game, reason, extra = {}) {
  if (!game || game.status === 'finished') return
  game.status = 'finished'
  const key = normalizeRoomCode(game.roomCode)
  clearRoundTimer(key)
  io.to(roomChannel(key)).emit('wordScrambleGame:ended', {
    game,
    reason,
    ...extra,
  })
  saveGameResults(game)
  archiveFinishedGame(game)
  setTimeout(() => {
    activeGames.delete(key)
  }, 10 * 60 * 1000)
}

async function slotToPlayer(slot) {
  let name = slot?.name
  let avatar = slot?.avatar
  if (!name || !avatar) {
    const user = await User.findById(slot.userId).select('name avatar').lean()
    if (user) {
      name = name || user.name || 'Unknown'
      avatar = avatar || user.avatar || ''
    }
  }
  return {
    userId: String(slot.userId),
    name: name || 'Unknown',
    avatar: avatar || '',
    score: 0,
    streak: 0,
    maxStreak: 0,
    correctCount: 0,
    isOut: false,
    ready: true,
  }
}

export function getGameResult(roomCode) {
  const key = normalizeRoomCode(roomCode)
  return finishedGames.get(key) || activeGames.get(key) || activeGames.get(roomCode)
}

export function registerWordScrambleGameHandlers(io, socket, rooms) {
  const userId = socket.userId
  if (!userId) return

  socket.on('wordScrambleGame:join', async ({ roomCode, difficulty }, ack) => {
    const code = normalizeRoomCode(roomCode)
    const room = rooms.get(code) || rooms.get(roomCode)
    if (!room) return ack?.({ ok: false, error: 'room_not_found' })

    socket.join(roomChannel(code))
    
    // Khởi tạo game nếu chưa có
    if (!activeGames.has(code)) {
      const level = ['easy', 'medium', 'hard'].includes(String(difficulty || '').toLowerCase())
        ? String(difficulty).toLowerCase()
        : 'medium'
      const startTime = Date.now()
      const durationSec = 180 // 3 minutes total
      const snapshot = Array.isArray(room.playerSnapshot) ? room.playerSnapshot : []
      const participants = snapshot.length > 0 ? snapshot : room.slots.filter(Boolean)
      console.log(`[Game] Initializing game ${code} with ${participants.length} players:`, participants.map(p => p.name))
      
      const players = await Promise.all(participants.map(slotToPlayer))
      activeGames.set(code, {
        roomCode: code,
        players,
        currentWord: null,
        turnIndex: 0,
        status: 'playing',
        difficulty: level,
        currentRoundId: 0,
        advancingRound: false,
        startTime,
        endTime: startTime + durationSec * 1000,
      })

      // Global game timer check
      const globalCheck = setInterval(() => {
        const g = activeGames.get(code)
        if (!g || g.status !== 'playing') {
          clearInterval(globalCheck)
          return
        }
        if (Date.now() >= g.endTime) {
          finishGame(io, g, 'total_time_up')
          clearInterval(globalCheck)
        }
      }, 1000)
    }

    const gameState = activeGames.get(code)
    if (!gameState) return ack?.({ ok: false, error: 'game_not_found' })

    // Đảm bảo toàn bộ người trong room được đồng bộ vào gameState.players
    const snapshot = Array.isArray(room.playerSnapshot) ? room.playerSnapshot : []
    const currentRoomSlots = snapshot.length > 0 ? snapshot : room.slots.filter(Boolean)
    let syncCount = 0
    
    for (const slot of currentRoomSlots) {
      const slotUserId = String(slot.userId)
      const exists = gameState.players.find(p => String(p.userId) === slotUserId)
      
      if (!exists) {
        syncCount++
        console.log(`[Game] [SYNC] Adding missing player ${slot.name} (${slotUserId}) to game ${roomCode}`)
        gameState.players.push(await slotToPlayer(slot))
      } else if (!exists.name || !exists.avatar) {
        const enriched = await slotToPlayer({ ...slot, name: exists.name, avatar: exists.avatar })
        exists.name = enriched.name
        exists.avatar = enriched.avatar
      }
    }

    if (syncCount > 0) {
      console.log(`[Game] [SYNC] Total ${syncCount} players synced into ${roomCode}. Current player count: ${gameState.players.length}`)
    }

    if (!gameState.currentWord) {
      const nextWord = await getRandomWord({ difficulty: gameState.difficulty || 'medium' })
      if (nextWord) {
        gameState.currentWord = buildTimedWord(nextWord)
        gameState.currentRoundId += 1
        scheduleRoundTimeout(io, gameState)
      }
    }
    ack?.({ ok: true, state: gameState })
    
    // Luôn phát update cho mọi người để đảm bảo frontend vẽ lại đúng danh sách
    io.to(roomChannel(code)).emit('wordScrambleGame:update', {
      game: gameState,
      lastAction: { userId: String(userId), type: 'sync_join' }
    })
  })

  socket.on('wordScrambleGame:submit', async ({ roomCode, answer, roundId }, ack) => {
    const code = normalizeRoomCode(roomCode)
    const game = activeGames.get(code)
    if (!game) return ack?.({ ok: false, error: 'game_not_found' })

    const playerIdx = game.players.findIndex(p => String(p.userId) === String(userId))
    if (playerIdx === -1) return ack?.({ ok: false, error: 'player_not_found' })
    if (game.status !== 'playing') return ack?.({ ok: false, error: 'game_finished' })
    
    const player = game.players[playerIdx]
    if (player.isOut) return ack?.({ ok: false, error: 'player_is_out' })

    if (!game.currentWord?.word) return ack?.({ ok: false, error: 'missing_current_word' })
    if (Number(roundId) !== Number(game.currentRoundId)) return ack?.({ ok: false, error: 'stale_round' })
    if (game.advancingRound) return ack?.({ ok: false, error: 'round_advancing' })

    const normalizedAnswer = String(answer || '').trim().toLowerCase()
    const targetWord = String(game.currentWord.word || '').trim().toLowerCase()
    const isCorrect = normalizedAnswer.length > 0 && normalizedAnswer === targetWord

    if (isCorrect) {
      game.advancingRound = true
      
      // Scoring: 10 + current streak
      player.score += (10 + player.streak)
      player.streak += 1
      player.correctCount += 1
      if (player.streak > player.maxStreak) player.maxStreak = player.streak
      
      try {
        const nextWord = await getRandomWord({ difficulty: game.difficulty || 'medium' })
        if (nextWord) {
          game.currentWord = buildTimedWord(nextWord)
          game.currentRoundId += 1
          scheduleRoundTimeout(io, game)
        }
      } finally {
        game.advancingRound = false
      }
    } else {
      player.streak = 0
    }

    // Phát tín hiệu cập nhật toàn bộ phòng
    io.to(roomChannel(code)).emit('wordScrambleGame:update', {
      game: {
        ...game,
        // Đảm bảo lấy danh sách player tươi nhất từ room nếu có thể (tùy chọn)
        players: game.players
      },
      lastAction: { userId, type: isCorrect ? 'correct' : 'wrong', answer: normalizedAnswer }
    })
    
    ack?.({ ok: true, correct: isCorrect })
  })

  socket.on('wordScrambleGame:nextWord', ({ roomCode, wordData }) => {
    const code = normalizeRoomCode(roomCode)
    const game = activeGames.get(code)
    if (!game) return
    game.currentWord = wordData
    game.currentRoundId += 1
    scheduleRoundTimeout(io, game)
    io.to(roomChannel(code)).emit('wordScrambleGame:newWord', { wordData })
  })

  socket.on('wordScrambleGame:leave', ({ roomCode }) => {
    const code = normalizeRoomCode(roomCode)
    socket.leave(roomChannel(code))
    const game = activeGames.get(code)
    if (game) {
      // Có thể xử lý khi người chơi thoát hẳn (xử thua hoặc kết thúc)
      if (game.status !== 'playing') clearRoundTimer(code)
    }
  })
}
