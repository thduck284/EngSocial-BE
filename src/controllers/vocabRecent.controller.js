import * as vocabRecentService from '../services/vocabRecent.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

export const getMyVocabRecent = async (req, res, next) => {
  try {
    const items = await vocabRecentService.getVocabRecentForUser(req.userId)
    return sendSuccess(res, { data: { items } }, req)
  } catch (err) {
    next(err)
  }
}

export const postMyVocabRecent = async (req, res, next) => {
  try {
    const items = await vocabRecentService.recordVocabRecentVisit(req.userId, req.body)
    return sendSuccess(res, { data: { items } }, req)
  } catch (err) {
    if (err.statusCode === 400) {
      return sendError(res, { statusCode: 400, message: err.message }, req)
    }
    next(err)
  }
}
