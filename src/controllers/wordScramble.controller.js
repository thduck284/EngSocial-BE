import * as wordScrambleService from '../services/wordScramble.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

export const getNextWord = async (req, res, next) => {
  try {
    const difficulty = String(req.query.difficulty || '').toLowerCase()
    const topic = req.query.topic != null ? String(req.query.topic) : ''
    const word = await wordScrambleService.getRandomWord({ difficulty, topic })
    return sendSuccess(res, { data: { word } }, req)
  } catch (err) {
    next(err)
  }
}

export const listWords = async (req, res, next) => {
  try {
    const result = await wordScrambleService.listWords({
      page: req.query.page,
      limit: req.query.limit,
      difficulty: req.query.difficulty,
      topic: req.query.topic,
      q: req.query.q,
      includeInactive: req.query.includeInactive === 'true' || req.query.includeInactive === '1',
    })
    return sendSuccess(res, { data: result }, req)
  } catch (err) {
    next(err)
  }
}

export const importTsv = async (req, res, next) => {
  try {
    const summary = await wordScrambleService.importWordsFromTsv(req.body.tsv)
    return sendSuccess(res, { data: { summary } }, req)
  } catch (err) {
    next(err)
  }
}

export const createWord = async (req, res, next) => {
  try {
    const item = await wordScrambleService.createWord(req.body)
    return sendSuccess(res, { data: { item } }, req)
  } catch (err) {
    if (err.statusCode === 409) {
      return sendError(res, { statusCode: 409, message: err.message }, req)
    }
    next(err)
  }
}

export const updateWord = async (req, res, next) => {
  try {
    const item = await wordScrambleService.updateWord(req.params.id, req.body)
    return sendSuccess(res, { data: { item } }, req)
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return sendError(res, { statusCode: err.statusCode, message: err.message }, req)
    }
    if (err.statusCode === 409) {
      return sendError(res, { statusCode: 409, message: err.message }, req)
    }
    next(err)
  }
}

export const deleteWord = async (req, res, next) => {
  try {
    await wordScrambleService.deleteWord(req.params.id)
    return sendSuccess(res, { data: { ok: true } }, req)
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      return sendError(res, { statusCode: err.statusCode, message: err.message }, req)
    }
    next(err)
  }
}

export const deleteAllWords = async (req, res, next) => {
  try {
    const result = await wordScrambleService.deleteAllWords()
    return sendSuccess(res, { data: result }, req)
  } catch (err) {
    next(err)
  }
}

export const getGameResults = async (req, res, next) => {
  try {
    const { roomCode } = req.params
    const { getGameResult } = await import('../sockets/wordScrambleGame.js')
    const game = getGameResult(roomCode)
    if (!game) {
      return sendError(res, { statusCode: 404, message: 'Game results not found or expired.' }, req)
    }
    return sendSuccess(res, { data: { game } }, req)
  } catch (err) {
    next(err)
  }
}

export const getSoloProgress = async (req, res, next) => {
  try {
    const result = await wordScrambleService.getSoloProgress(req.userId)
    return sendSuccess(res, { data: result }, req)
  } catch (err) {
    next(err)
  }
}

export const updateSoloProgress = async (req, res, next) => {
  try {
    const { stage } = req.body
    const result = await wordScrambleService.updateSoloProgress(req.userId, stage)
    return sendSuccess(res, { data: result }, req)
  } catch (err) {
    if (err.message === 'INVALID_STAGE') {
      return sendError(res, { statusCode: 400, message: 'Invalid stage parameter' }, req)
    }
    next(err)
  }
}

