import * as gameService from '../services/game.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getGames = async (req, res, next) => {
  try {
    const { type, difficulty, status, page, limit } = req.query
    const result = await gameService.getGames({ type, difficulty, status, page, limit })
    return sendPaginated(res, {
      messageKey: 'game.listSuccess',
      data: result.games,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getGameById = async (req, res, next) => {
  try {
    const game = await gameService.getGameById(req.params.id)
    return sendSuccess(res, {
      messageKey: 'game.detailSuccess',
      data: { game },
    }, req)
  } catch (error) {
    if (error.message === 'GAME_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'game.notFound' }, req)
    }
    next(error)
  }
}

export const createGame = async (req, res, next) => {
  try {
    const game = await gameService.createGame(req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'game.createSuccess',
      data: { game },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const startSession = async (req, res, next) => {
  try {
    const session = await gameService.startGameSession(req.userId, req.params.id)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'game.sessionStarted',
      data: { session },
    }, req)
  } catch (error) {
    if (error.message === 'GAME_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'game.notFound' }, req)
    }
    if (error.message === 'GAME_NOT_ACTIVE') {
      return sendError(res, { statusCode: 400, messageKey: 'game.notActive' }, req)
    }
    next(error)
  }
}

export const submitSession = async (req, res, next) => {
  try {
    const session = await gameService.submitGameSession(req.userId, req.params.sessionId, req.body)
    return sendSuccess(res, {
      messageKey: 'game.sessionSubmitted',
      data: { session },
    }, req)
  } catch (error) {
    if (error.message === 'SESSION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'game.sessionNotFound' }, req)
    }
    next(error)
  }
}

export const getUserHistory = async (req, res, next) => {
  try {
    const { gameId, page, limit } = req.query
    const result = await gameService.getUserGameHistory(req.userId, { gameId, page, limit })
    return sendPaginated(res, {
      messageKey: 'game.historySuccess',
      data: result.sessions,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}
