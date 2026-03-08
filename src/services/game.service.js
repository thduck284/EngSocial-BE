import { Game, GameSession, User } from '../models/index.js'
import { GameDTO, GameSessionDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Get all games
 */
export const getGames = async ({ type, difficulty, status = 'active', page = 1, limit = 10 }) => {
  const filter = {}
  if (type) filter.type = type
  if (difficulty) filter.difficulty = difficulty
  if (status) filter.status = status

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Game.countDocuments(filter)
  const games = await Game.find(filter).sort({ featured: -1, playCount: -1 }).skip(skip).limit(perPage)

  return {
    games: games.map(g => new GameDTO(g)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get game by ID
 */
export const getGameById = async (gameId) => {
  const game = await Game.findById(gameId)
  if (!game) throw new Error('GAME_NOT_FOUND')
  return new GameDTO(game)
}

/**
 * Create game (admin)
 */
export const createGame = async (data) => {
  const game = await Game.create(data)
  return new GameDTO(game)
}

/**
 * Start a game session
 */
export const startGameSession = async (userId, gameId) => {
  const game = await Game.findById(gameId)
  if (!game) throw new Error('GAME_NOT_FOUND')
  if (game.status !== 'active') throw new Error('GAME_NOT_ACTIVE')

  const session = await GameSession.create({
    gameId,
    userId,
    score: 0,
    correctAnswers: 0,
    totalQuestions: game.config?.questionsPerRound || 10,
    streak: 0,
    xpEarned: 0,
    startedAt: new Date(),
  })

  await Game.findByIdAndUpdate(gameId, { $inc: { currentPlaying: 1 } })
  return new GameSessionDTO(session)
}

/**
 * Submit game session result
 */
export const submitGameSession = async (userId, sessionId, { answers, score, correctAnswers, streak, duration }) => {
  const session = await GameSession.findOne({ _id: sessionId, userId })
  if (!session) throw new Error('SESSION_NOT_FOUND')

  const game = await Game.findById(session.gameId)

  session.answers = answers || []
  session.score = score || 0
  session.correctAnswers = correctAnswers || 0
  session.streak = streak || 0
  session.duration = duration || 0
  session.endedAt = new Date()

  // Calculate XP
  const xpPerCorrect = game?.config?.xpPerCorrect || 5
  const streakBonus = game?.config?.streakBonus || 2
  const xpEarned = (session.correctAnswers * xpPerCorrect) + (session.streak * streakBonus)
  session.xpEarned = xpEarned

  await session.save()

  // Update user XP
  await User.findByIdAndUpdate(userId, {
    $inc: { xp: xpEarned, totalXp: xpEarned },
    lastActiveDate: new Date(),
  })

  // Update game stats
  await Game.findByIdAndUpdate(session.gameId, {
    $inc: { playCount: 1, currentPlaying: -1 },
  })

  return new GameSessionDTO(session)
}

/**
 * Get user's game history
 */
export const getUserGameHistory = async (userId, { gameId, page = 1, limit = 10 }) => {
  const filter = { userId }
  if (gameId) filter.gameId = gameId

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await GameSession.countDocuments(filter)
  const sessions = await GameSession.find(filter)
    .populate('gameId', 'title titleVi key type icon')
    .sort({ startedAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    sessions: sessions.map(s => new GameSessionDTO(s)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}
