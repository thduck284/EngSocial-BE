import mongoose from 'mongoose'
import PeriodicQuestPool from '../models/gamification/PeriodicQuestPool.js'
import { sendSuccess, sendError } from '../dto/index.js'
import {
  ensureUserPeriodicQuests,
  serializePeriodicQuestForClient,
} from '../services/userPeriodicQuest.service.js'

export const QUEST_FILTER_CATEGORIES = [
  'all',
  'lesson',
  'practice',
  'friends',
  'vocabulary_notes',
  'community_post',
  'login_streak',
  'online_time',
]

function readTargetBounds(condition = {}) {
  let targetMin = Number(condition.targetMin ?? condition.target ?? 1)
  if (!Number.isFinite(targetMin) || targetMin < 1) targetMin = 1
  let targetMax = Number(condition.targetMax ?? condition.target ?? targetMin)
  if (!Number.isFinite(targetMax) || targetMax < 1) targetMax = targetMin
  if (targetMax < targetMin) targetMax = targetMin
  return { targetMin, targetMax }
}

/** Không dùng skill / minScorePercent — nhiệm vụ xã hội hoặc engagement (streak, thời gian online). */
const NO_SKILL_SCORE_QUEST_CATEGORIES = [
  'friends',
  'vocabulary_notes',
  'community_post',
  'login_streak',
  'online_time',
]

function poolPayloadFromBody(body = {}) {
  const periodType = body.periodType || body.type
  if (!['daily', 'weekly'].includes(periodType)) {
    return { error: { statusCode: 400, messageKey: 'periodicQuest.poolInvalidPeriod' } }
  }
  const condition = normalizeCondition(body)
  const xpRaw = Number(body.xpReward)
  const xpReward = Number.isFinite(xpRaw) ? Math.min(1_000_000, Math.max(0, xpRaw)) : 50
  const iconRaw = typeof body.icon === 'string' ? body.icon.trim() : ''
  const icon = iconRaw ? iconRaw.slice(0, 64) : 'flag'
  const status = ['active', 'archived'].includes(body.status) ? body.status : 'active'
  return {
    payload: {
      periodType,
      category: condition.filters.category,
      skill: condition.filters.skill,
      minScorePercent: condition.filters.minScorePercent,
      targetMin: condition.targetMin,
      targetMax: condition.targetMax,
      xpReward,
      icon,
      status,
    },
  }
}

function normalizeCondition(body = {}) {
  const conditionBody = body.condition || {}
  let category = conditionBody.filters?.category ?? 'all'
  if (typeof category !== 'string' || !QUEST_FILTER_CATEGORIES.includes(category)) {
    category = 'all'
  }
  let skill = conditionBody.filters?.skill ?? body.skill ?? 'all'
  let minScorePercent = Number(conditionBody.filters?.minScorePercent ?? 0)
  if (!Number.isFinite(minScorePercent)) minScorePercent = 0
  minScorePercent = Math.min(100, Math.max(0, minScorePercent))

  if (NO_SKILL_SCORE_QUEST_CATEGORIES.includes(category)) {
    skill = 'all'
    minScorePercent = 0
  } else if (category === 'practice') {
    minScorePercent = 0
  }

  const { targetMin, targetMax } = readTargetBounds({
    targetMin: conditionBody.targetMin ?? conditionBody.target ?? body.targetValue,
    targetMax: conditionBody.targetMax ?? conditionBody.target ?? conditionBody.targetMin ?? body.targetValue,
    target: conditionBody.target ?? body.targetValue,
  })

  return {
    target: targetMin,
    targetMin,
    targetMax,
    filters: {
      skill,
      category,
      minScorePercent,
    },
  }
}

/**
 * Nhiệm vụ chu kỳ theo user (daily / weekly). Tiêu đề / mô tả hiển thị do FE (quests.periodicTitle / periodicDesc).
 * GET /api/quests/my/period
 */
export const getMyPeriodicQuests = async (req, res, next) => {
  try {
    const docs = await ensureUserPeriodicQuests(req.userId)
    const quests = docs.map(serializePeriodicQuestForClient)
    return sendSuccess(res, { data: { quests }, messageKey: 'periodicQuest.listSuccess' }, req)
  } catch (error) {
    next(error)
  }
}



/**
 * Kho mẫu quest chu kỳ (PeriodicQuestPool) — mod/admin.
 * GET /api/quests/pool
 */
export const getPeriodicQuestPool = async (req, res, next) => {
  try {
    const docs = await PeriodicQuestPool.find({})
      .sort({ periodType: 1, category: 1, createdAt: -1 })
      .lean()
    const data = docs.map((d) => ({
      ...d,
      id: d._id.toString(),
    }))
    return sendSuccess(res, { data, messageKey: 'periodicQuest.poolListSuccess' }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Chi tiết một mẫu trong kho — mod/admin.
 * GET /api/quests/pool/:poolId
 */
export const getPeriodicQuestPoolById = async (req, res, next) => {
  try {
    const { poolId } = req.params
    if (!mongoose.isValidObjectId(poolId)) {
      return sendError(res, { statusCode: 400, messageKey: 'common.invalidId' }, req)
    }
    const doc = await PeriodicQuestPool.findById(poolId).lean()
    if (!doc) {
      return sendError(res, { statusCode: 404, messageKey: 'periodicQuest.poolNotFound' }, req)
    }
    return sendSuccess(
      res,
      { data: { ...doc, id: doc._id.toString() }, messageKey: 'periodicQuest.poolOneSuccess' },
      req
    )
  } catch (error) {
    next(error)
  }
}

/**
 * Thêm mẫu vào kho — mod/admin.
 * POST /api/quests/pool
 */
export const createPeriodicQuestPoolEntry = async (req, res, next) => {
  try {
    const parsed = poolPayloadFromBody(req.body)
    if (parsed.error) return sendError(res, parsed.error, req)
    const created = await PeriodicQuestPool.create(parsed.payload)
    return sendSuccess(
      res,
      { data: { ...created.toObject(), id: created._id.toString() }, messageKey: 'periodicQuest.poolCreated' },
      req,
      201
    )
  } catch (error) {
    next(error)
  }
}

/**
 * Cập nhật mẫu trong kho — mod/admin.
 * PUT /api/quests/pool/:poolId
 */
export const updatePeriodicQuestPoolEntry = async (req, res, next) => {
  try {
    const { poolId } = req.params
    if (!mongoose.isValidObjectId(poolId)) {
      return sendError(res, { statusCode: 400, messageKey: 'common.invalidId' }, req)
    }
    const parsed = poolPayloadFromBody(req.body)
    if (parsed.error) return sendError(res, parsed.error, req)
    const updated = await PeriodicQuestPool.findByIdAndUpdate(poolId, parsed.payload, {
      new: true,
      runValidators: true,
    }).lean()
    if (!updated) {
      return sendError(res, { statusCode: 404, messageKey: 'periodicQuest.poolNotFound' }, req)
    }
    return sendSuccess(res, { data: { ...updated, id: updated._id.toString() }, messageKey: 'periodicQuest.poolUpdated' }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Xóa một mẫu trong kho — mod/admin.
 * DELETE /api/quests/pool/:poolId
 */
export const deletePeriodicQuestPoolEntry = async (req, res, next) => {
  try {
    const { poolId } = req.params
    if (!mongoose.isValidObjectId(poolId)) {
      return sendError(res, { statusCode: 400, messageKey: 'common.invalidId' }, req)
    }
    const deleted = await PeriodicQuestPool.findByIdAndDelete(poolId)
    if (!deleted) {
      return sendError(res, { statusCode: 404, messageKey: 'periodicQuest.poolNotFound' }, req)
    }
    return sendSuccess(res, { messageKey: 'periodicQuest.poolDeleted' }, req)
  } catch (error) {
    next(error)
  }
}



