import { isUserOnline } from '../config/socket.js'
import { getRandomWord } from '../services/wordScramble.service.js'

const roomChannel = (code) => `room:${code}`
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const buildTimedWord = (wordData) => {
  if (!wordData?.word) return null
  const normalized = String(wordData.word).trim()
  const timeLimitSec = Math.max(1, normalized.length * 3 + randomInt(1, 5))
  return { ...wordData, timeLimitSec }
}
const clearRoundTimer = (game) => {
  if (game?.roundTimer) {
    clearTimeout(game.roundTimer)
    game.roundTimer = null
  }
}
const scheduleRoundTimeout = (io, game) => {
  clearRoundTimer(game)
  if (!game?.currentWord?.timeLimitSec || game.status !== 'playing') return
  const roundIdAtSchedule = Number(game.currentRoundId || 0)
  game.roundTimer = setTimeout(() => {
    if (game.status !== 'playing') return
    if (Number(game.currentRoundId || 0) !== roundIdAtSchedule) return
    game.status = 'finished'
    io.to(roomChannel(game.roomCode)).emit('wordScrambleGame:ended', {
      game,
      reason: 'timeout',
      roundId: roundIdAtSchedule,
    })
    io.to(roomChannel(game.roomCode)).emit('wordScrambleGame:update', {
      game,
      lastAction: { type: 'timeout', roundId: roundIdAtSchedule },
    })
  }, Number(game.currentWord.timeLimitSec) * 1000)
}

// Lưu trữ trạng thái game tạm thời trong RAM (trong sản xuất nên dùng Redis)
// code -> { players: [{userId, name, score, streak}], currentWord: {word, meaning, example}, turnIndex: 0 }
const activeGames = new Map()

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
      activeGames.set(roomCode, {
        roomCode,
        players: room.slots.filter(Boolean).map(s => ({
          userId: s.userId,
          name: s.name,
          score: 0,
          streak: 0,
          ready: true
        })),
        currentWord: null,
        turnIndex: 0,
        status: 'playing',
        difficulty: level,
        currentRoundId: 0,
        advancingRound: false,
        roundTimer: null,
      })
    }

    const gameState = activeGames.get(roomCode)
    if (!gameState.currentWord) {
      const nextWord = await getRandomWord({ difficulty: gameState.difficulty || 'medium' })
      if (nextWord) {
        gameState.currentWord = buildTimedWord(nextWord)
        gameState.currentRoundId += 1
        scheduleRoundTimeout(io, gameState)
      }
    }
    ack?.({ ok: true, state: gameState })
    
    // Thông báo cho mọi người là có người vào game
    io.to(roomChannel(roomCode)).emit('wordScrambleGame:playerJoined', { userId })
  })

  socket.on('wordScrambleGame:submit', async ({ roomCode, answer, roundId }, ack) => {
    const game = activeGames.get(roomCode)
    if (!game) return ack?.({ ok: false, error: 'game_not_found' })

    const playerIdx = game.players.findIndex(p => String(p.userId) === String(userId))
    if (playerIdx === -1) return ack?.({ ok: false, error: 'player_not_found' })
    if (game.status !== 'playing') return ack?.({ ok: false, error: 'game_finished' })
    if (!game.currentWord?.word) return ack?.({ ok: false, error: 'missing_current_word' })
    if (Number(roundId) !== Number(game.currentRoundId)) return ack?.({ ok: false, error: 'stale_round' })
    if (game.advancingRound) return ack?.({ ok: false, error: 'round_advancing' })

    const player = game.players[playerIdx]
    const normalizedAnswer = String(answer || '').trim().toLowerCase()
    const targetWord = String(game.currentWord.word || '').trim().toLowerCase()
    const isCorrect = normalizedAnswer.length > 0 && normalizedAnswer === targetWord

    if (isCorrect) {
      game.advancingRound = true
      const add = 10 + Math.min(player.streak, 5) * 2
      player.score += add
      player.streak += 1
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
      game,
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
      if (game.status !== 'playing') clearRoundTimer(game)
    }
  })
}
