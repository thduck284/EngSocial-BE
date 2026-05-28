import { isUserOnline } from '../config/socket.js'
import { getRandomWord } from '../services/wordScramble.service.js'
import { Game, GameSession, User, UserGameStats } from '../models/index.js'

const WORLD_CHANNEL = 'snake_world'
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// Game configuration
const MAP_WIDTH = 20000 
const MAP_HEIGHT = 20000
const GRID_SIZE = 20
const TICK_RATE = 30 
const BASE_SPEED = 4
const BOOST_SPEED = 10
const DISTRACTOR_COUNT = 1700
const CORRECT_FOOD_COUNT = 300 

// Global State
const world = {
  players: new Map(), // userId -> player
  food: [],
  wordPool: [], // ~50 unique words
  status: 'active',
  loop: null,
  foodChanged: false
}

const generateFoodPool = async (forceNewPool = false) => {
  if (forceNewPool || world.wordPool.length < 50) {
      const newPool = []
      for (let i = 0; i < 50; i++) {
          const w = await getRandomWord({ difficulty: 'medium' })
          if (w) newPool.push(w)
      }
      if (newPool.length > 0) {
          world.wordPool = newPool
      } else if (world.wordPool.length === 0) {
          // Fallback if DB is completely empty
          world.wordPool = [
              { word: 'apple', meaning: 'quả táo' },
              { word: 'banana', meaning: 'quả chuối' },
              { word: 'cat', meaning: 'con mèo' },
              { word: 'dog', meaning: 'con chó' },
              { word: 'elephant', meaning: 'con voi' }
          ]
      }
  }

  const TOTAL_WORD_FOOD = DISTRACTOR_COUNT + CORRECT_FOOD_COUNT
  const currentWordCount = world.food.filter(f => !f.isDroppedPoints).length
  
  const getRandomSafePosition = () => {
      let bestX = randomInt(100, MAP_WIDTH - 100)
      let bestY = randomInt(100, MAP_HEIGHT - 100)
      let maxMinDist = 0

      for (let attempts = 0; attempts < 10; attempts++) {
          const x = randomInt(100, MAP_WIDTH - 100)
          const y = randomInt(100, MAP_HEIGHT - 100)
          
          let minDistSq = Infinity
          for (let i = 0; i < world.food.length; i++) {
              const f = world.food[i]
              if (!f) continue
              const dx = f.x - x
              const dy = f.y - y
              const distSq = dx*dx + dy*dy
              if (distSq < minDistSq) minDistSq = distSq
          }

          if (minDistSq > 22500) return { x, y } // > 150px safe distance
          
          if (minDistSq > maxMinDist) {
              maxMinDist = minDistSq
              bestX = x
              bestY = y
          }
      }
      return { x: bestX, y: bestY }
  }

  if (currentWordCount < TOTAL_WORD_FOOD && world.wordPool.length > 0) {
    world.foodChanged = true
    for (let i = currentWordCount; i < TOTAL_WORD_FOOD; i++) {
      const randomWord = world.wordPool[randomInt(0, world.wordPool.length - 1)] || world.wordPool[0]
      const pos = getRandomSafePosition()
      world.food.push({
        id: `food_${Date.now()}_${randomInt(0, 9999)}`,
        x: pos.x,
        y: pos.y,
        text: randomWord.word || 'Unknown',
        meaning: randomWord.meaning || '',
        isCorrect: false
      })
    }
  }
}

const replaceFoodItem = (foodId) => {
    const idx = world.food.findIndex(f => f.id === foodId)
    if (idx === -1) return
    const old = world.food[idx]
    
    if (old.isDroppedPoints) {
        world.food.splice(idx, 1)
        world.foodChanged = true
        return
    }

    const randomWord = world.wordPool[randomInt(0, world.wordPool.length - 1)] || world.wordPool[0] || { word: 'Bonus', meaning: 'Điểm cộng' }
    
    let bestX = randomInt(100, MAP_WIDTH - 100)
    let bestY = randomInt(100, MAP_HEIGHT - 100)
    for (let attempts = 0; attempts < 5; attempts++) {
        const x = randomInt(100, MAP_WIDTH - 100)
        const y = randomInt(100, MAP_HEIGHT - 100)
        let minDistSq = Infinity
        for (let i = 0; i < world.food.length; i++) {
            if (i === idx) continue
            const f = world.food[i]
            if (!f) continue
            const dx = f.x - x
            const dy = f.y - y
            const distSq = dx*dx + dy*dy
            if (distSq < minDistSq) minDistSq = distSq
        }
        if (minDistSq > 22500) {
            bestX = x
            bestY = y
            break
        }
    }

    world.foodChanged = true
    world.food[idx] = {
        ...old,
        id: `food_${Date.now()}_${randomInt(0, 9999)}`,
        x: bestX,
        y: bestY,
        text: randomWord.word || 'Bonus',
        meaning: randomWord.meaning || 'Điểm cộng'
    }
}

const dropPoints = (player) => {
    const dropCount = Math.min(player.snake.length, 30) 
    const pointsPerDrop = Math.max(1, Math.floor(player.score / dropCount))
    
    player.snake.forEach((seg, idx) => {
        if (idx % Math.max(1, Math.ceil(player.snake.length / dropCount)) === 0) {
            world.foodChanged = true
            world.food.push({
                id: `dropped_${player.userId}_${idx}_${Date.now()}`,
                x: seg.x,
                y: seg.y,
                text: `+${pointsPerDrop}`,
                isCorrect: false,
                isDroppedPoints: true,
                value: pointsPerDrop
            })
        }
    })
}

const updateWorld = async (io) => {
  if (world.players.size === 0) return

  try {
    const deadPlayerIds = []
    
    world.players.forEach((player, userId) => {
      if (!player || !player.snake || player.snake.length === 0) return

      const speed = player.isBoosting ? BOOST_SPEED : BASE_SPEED
      const head = { ...player.snake[0] }
      
      head.x += Math.cos(player.angle || 0) * speed
      head.y += Math.sin(player.angle || 0) * speed

      if (head.x < 0) head.x = MAP_WIDTH
      if (head.x > MAP_WIDTH) head.x = 0
      if (head.y < 0) head.y = MAP_HEIGHT
      if (head.y > MAP_HEIGHT) head.y = 0

      let collided = false
      world.players.forEach((other, otherId) => {
          if (!other || !other.snake) return
          // Disable self-collision: skip if this is the same player
          if (otherId === userId) return 

          other.snake.forEach((seg, idx) => {
              const dx = head.x - seg.x
              const dy = head.y - seg.y
              if (dx*dx + dy*dy < 400) collided = true
          })
      })

      if (collided) {
          deadPlayerIds.push(userId)
          return
      }

      let ateCorrect = false
      let ateWrong = false
      let ateDropped = false
      let foodEaten = null
      
      world.food.forEach((f) => {
        if (!f) return
        const dx = head.x - f.x
        const dy = head.y - f.y
        const distSq = dx*dx + dy*dy
        const collisionRadius = f.isDroppedPoints ? 20 : (f.text ? f.text.length * 6 + 20 : 30)
        
        if (distSq < collisionRadius * collisionRadius) {
          foodEaten = f
          if (f.isDroppedPoints) ateDropped = true
          else if (player.targetWord && f.text === player.targetWord.word) ateCorrect = true
          else ateWrong = true
        }
      })

      player.snake.unshift(head)
      
      const boostBonus = player.isBoosting ? Math.floor(player.score * 0.2) + 5 : 0
      const targetLen = 10 + player.score + boostBonus

      if (ateCorrect) {
        player.score += (10 + player.streak)
        player.streak += 1
        player.correctCount += 1
        if (player.streak > player.maxStreak) player.maxStreak = player.streak
        
        if (player.snake.length > targetLen) player.snake.pop()

        if (foodEaten) {
            const fIdx = world.food.findIndex(f => f.id === foodEaten.id)
            if (fIdx !== -1) {
                world.food.splice(fIdx, 1)
                world.foodChanged = true
            }
        }

        if (world.wordPool.length > 0) {
            player.targetWord = world.wordPool[randomInt(0, world.wordPool.length - 1)]
        }
        
        const spawnAngle = Math.random() * Math.PI * 2
        const spawnDist = randomInt(2000, 2500)
        world.food.push({
            id: `food_${Date.now()}_${randomInt(0, 999)}`,
            x: Math.max(0, Math.min(MAP_WIDTH, head.x + Math.cos(spawnAngle) * spawnDist)),
            y: Math.max(0, Math.min(MAP_HEIGHT, head.y + Math.sin(spawnAngle) * spawnDist)),
            text: player.targetWord?.word || 'Bonus',
            meaning: player.targetWord?.meaning || '',
            isCorrect: false 
        })
        world.foodChanged = true
        generateFoodPool(false).catch(() => {})
      } else if (ateDropped) {
        player.score += (foodEaten.value || 2)
        if (player.snake.length > targetLen) player.snake.pop()
        if (foodEaten) replaceFoodItem(foodEaten.id)
      } else if (ateWrong) {
        player.wrongCount = (player.wrongCount || 0) + 1
        const penalty = player.wrongCount
        if (penalty > player.score) {
          deadPlayerIds.push(userId)
          return
        }
        player.score -= penalty
        player.streak = 0
        if (foodEaten) replaceFoodItem(foodEaten.id)
      } else {
        if (player.snake.length > targetLen) player.snake.pop()
      }
    })

    deadPlayerIds.forEach(id => {
        const p = world.players.get(id)
        if (p) {
            dropPoints(p)
            io.to(WORLD_CHANNEL).emit('snakeGameGame:died', { userId: id, score: p.score })
            saveSingleResult(p)
            world.players.delete(id)
        }
    })

    io.to(WORLD_CHANNEL).emit('snakeGameGame:tick', {
      players: Array.from(world.players.values()).map(p => ({
        userId: p.userId,
        snake: p.snake,
        score: p.score,
        streak: p.streak,
        wrongCount: p.wrongCount || 0,
        isBoosting: p.isBoosting,
        targetWord: p.targetWord,
        angle: p.angle || 0,
        name: p.name,
        avatar: p.avatar,
        skinId: p.skinId
      })),
      food: world.foodChanged ? world.food : undefined
    })
    world.foodChanged = false
  } catch (err) {
    console.error('Error in snake updateWorld loop:', err)
  }
}

const saveSingleResult = async (p) => {
    try {
        const game = await Game.findOne({ key: 'snake-word' })
        if (game) {
            await GameSession.create({
                gameId: game._id, userId: p.userId, score: p.score,
                stats: { correctCount: p.correctCount, maxStreak: p.maxStreak },
                playedAt: new Date()
            })
            const stats = await UserGameStats.findOne({ userId: p.userId, gameId: game._id })
            if (stats) {
                stats.totalScore += p.score
                stats.playCount += 1
                stats.maxScore = Math.max(stats.maxScore, p.score)
                await stats.save()
            } else {
                await UserGameStats.create({
                    userId: p.userId, gameId: game._id, totalScore: p.score,
                    playCount: 1, maxScore: p.score
                })
            }
        }
    } catch (err) {}
}

export const registerSnakeGameGameHandlers = (io, socket) => {
  const userId = socket.userId
  
  socket.on('snakeGameGame:joinWorld', async (data, callback) => {
    if (!userId) return callback?.({ ok: false })
    const user = await User.findById(userId)
    if (!user) return callback?.({ ok: false })

    if (world.wordPool.length === 0) await generateFoodPool(true)

    const startX = randomInt(100, MAP_WIDTH - 100)
    const startY = randomInt(100, MAP_HEIGHT - 100)

    const fallbackWord = { word: 'Welcome', meaning: 'Chào mừng' }
    const player = {
      userId, name: user.name, avatar: user.avatar,
      score: 0, streak: 0, wrongCount: 0, isBoosting: false, angle: 0,
      maxStreak: 0, correctCount: 0, skinId: data?.skinId || 'cyan',
      targetWord: (world.wordPool.length > 0 ? world.wordPool[randomInt(0, world.wordPool.length - 1)] : fallbackWord) || fallbackWord,
      snake: Array(10).fill({ x: startX, y: startY })
    }
    
    world.players.set(String(userId), player)
    socket.join(WORLD_CHANNEL)
    callback?.({ ok: true, state: { food: world.food, mapSize: { width: MAP_WIDTH, height: MAP_HEIGHT } } })

    if (!world.loop) world.loop = setInterval(() => updateWorld(io), TICK_RATE)
  })

  socket.on('snakeGameGame:move', ({ angle, boost }) => {
    const player = world.players.get(String(userId))
    if (!player) return
    if (angle !== undefined) player.angle = angle
    if (boost !== undefined) player.isBoosting = !!boost
  })

  socket.on('disconnect', () => {
    const p = world.players.get(String(userId))
    if (p) { saveSingleResult(p); world.players.delete(String(userId)) }
    if (world.players.size === 0 && world.loop) { clearInterval(world.loop); world.loop = null }
  })
}
