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
      game.status = 'finished'
      io.to(roomChannel(game.roomCode)).emit('wordScrambleGame:ended', {
        game,
        reason: 'all_out',
        roundId: roundIdAtSchedule,
      })
      saveGameResults(game)
      // Clean up from memory after 10 minutes
      setTimeout(() => {
        activeGames.delete(game.roomCode)
      }, 10 * 60 * 1000)
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

export function getGameResult(roomCode) {
  return activeGames.get(roomCode)
}

export function registerWordScrambleGameHandlers(io, socket, rooms) {
  const userId = socket.userId
  if (!userId) return

  socket.on('wordScrambleGame:join', async ({ roomCode, difficulty }, ack) => {
    const room = rooms.get(roomCode)
    if (!room) return ack?.({ ok: false, error: 'room_not_found' })

    socket.join(roomChannel(roomCode))
    
    // Khởi tạo game nếu chưa có
    if (!activeGames.has(roomCode)) {
      const level = ['easy', 'medium', 'hard'].includes(String(difficulty || '').toLowerCase())
        ? String(difficulty).toLowerCase()
        : 'medium'
      const startTime = Date.now()
      const durationSec = 180 // 3 minutes total
      const participants = room.slots.filter(Boolean)
      console.log(`[Game] Initializing game ${roomCode} with ${participants.length} players:`, participants.map(p => p.name))
      
      activeGames.set(roomCode, {
        roomCode,
        players: participants.map(s => ({
          userId: s.userId,
          name: s.name,
          avatar: s.avatar,
          score: 0,
          streak: 0,
          maxStreak: 0,
          correctCount: 0,
          isOut: false,
          ready: true
        })),
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
        const g = activeGames.get(roomCode)
        if (!g || g.status !== 'playing') {
          clearInterval(globalCheck)
          return
        }
        if (Date.now() >= g.endTime) {
          g.status = 'finished'
          io.to(roomChannel(roomCode)).emit('wordScrambleGame:ended', {
            game: g,
            reason: 'total_time_up',
          })
          saveGameResults(g)
          // Clean up from memory after 10 minutes
          setTimeout(() => {
            activeGames.delete(roomCode)
          }, 10 * 60 * 1000)
          clearInterval(globalCheck)
        }
      }, 1000)
    }

    const gameState = activeGames.get(roomCode)
    if (!gameState) return ack?.({ ok: false, error: 'game_not_found' })

    // Đảm bảo toàn bộ người trong room.slots đều được đồng bộ vào gameState.players
    const currentRoomSlots = room.slots.filter(Boolean)
    let syncCount = 0
    
    currentRoomSlots.forEach(slot => {
      const slotUserId = String(slot.userId)
      const exists = gameState.players.find(p => String(p.userId) === slotUserId)
      
      if (!exists) {
        syncCount++
        console.log(`[Game] [SYNC] Adding missing player ${slot.name} (${slotUserId}) to game ${roomCode}`)
        gameState.players.push({
          userId: slotUserId,
          name: slot.name,
          avatar: slot.avatar,
          score: 0,
          streak: 0,
          maxStreak: 0,
          correctCount: 0,
          isOut: false,
          ready: true
        })
      }
    })

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
    io.to(roomChannel(roomCode)).emit('wordScrambleGame:update', {
      game: gameState,
      lastAction: { userId: String(userId), type: 'sync_join' }
    })
  })

  socket.on('wordScrambleGame:submit', async ({ roomCode, answer, roundId }, ack) => {
    const game = activeGames.get(roomCode)
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
    io.to(roomChannel(roomCode)).emit('wordScrambleGame:update', {
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
    const game = activeGames.get(roomCode)
    if (!game) return
    game.currentWord = wordData
    game.currentRoundId += 1
    scheduleRoundTimeout(io, game)
    io.to(roomChannel(roomCode)).emit('wordScrambleGame:newWord', { wordData })
  })

  socket.on('wordScrambleGame:leave', ({ roomCode }) => {
    socket.leave(roomChannel(roomCode))
    const game = activeGames.get(roomCode)
    if (game) {
      // Có thể xử lý khi người chơi thoát hẳn (xử thua hoặc kết thúc)
      if (game.status !== 'playing') clearRoundTimer(roomCode)
    }
  })
}
