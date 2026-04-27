import mongoose from 'mongoose'
import Quest, { QUEST_FILTER_CATEGORIES } from '../models/gamification/Quest.js'
import PeriodicQuestPool from '../models/gamification/PeriodicQuestPool.js'
import { sendSuccess, sendError } from '../dto/index.js'
import { readTargetBounds, listMyQuestProgress } from '../services/questProgress.service.js'
import {
  ensureUserPeriodicQuests,
  serializePeriodicQuestForClient,
} from '../services/userPeriodicQuest.service.js'

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
 * Tiến độ quest catalog (Quest) — legacy; periodic dùng GET /quests/my/period
 * GET /api/quests/my/progress
 */
export const getMyQuestProgress = async (req, res, next) => {
  try {
    const userId = req.userId
    const status = req.query.status || 'active'
    const data = await listMyQuestProgress(userId, { status })
    return sendSuccess(res, { data }, req)
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

export const getQuests = async (req, res, next) => {
  try {
    const { type, status } = req.query
    const filter = {}
    if (status === 'all' || status === '*') {
      /* staff list: mọi trạng thái */
    } else {
      filter.status = status || 'active'
    }
    if (type) filter.type = type
    const docs = await Quest.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .lean()
    const data = docs.map((q) => ({
      ...q,
      id: q._id?.toString() || q.id,
    }))
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Get single quest by id (admin)
 * GET /api/quests/:id
 */
export const getQuestById = async (req, res, next) => {
  try {
    const { id } = req.params
    const quest = await Quest.findById(id).lean()
    if (!quest) {
      return sendError(res, { statusCode: 404, message: 'Quest not found' }, req)
    }
    return sendSuccess(res, { data: { ...quest, id: quest._id?.toString() } }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Create quest (admin)
 * POST /api/quests
 */
export const createQuest = async (req, res, next) => {
  try {
    const body = req.body
    const condition = normalizeCondition(body)
    const payload = {
      title: body.title,
      description: body.description ?? '',
      type: body.type || 'daily',
      condition,
      xpReward: body.xpReward ?? 50,
      icon: body.icon || 'flag',
      status: body.status || 'active',
      order: body.order ?? 0,
    }
    const quest = await Quest.create(payload)
    return sendSuccess(res, { data: { ...quest.toObject(), id: quest._id.toString() } }, req, 201)
  } catch (error) {
    next(error)
  }
}

/**
 * Update quest (admin)
 * PUT /api/quests/:id
 */
export const updateQuest = async (req, res, next) => {
  try {
    const body = { ...req.body }
    if (
      body.condition
      || body.targetValue != null
      || body.skill
      || body.targetMin != null
      || body.targetMax != null
    ) {
      body.condition = normalizeCondition(body)
    }
    delete body.targetType
    delete body.targetValue
    delete body.skill
    if (body.condition && body.condition.type) delete body.condition.type
    const quest = await Quest.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    ).lean()
    if (!quest) {
      return sendError(res, { statusCode: 404, message: 'Quest not found' }, req)
    }
    return sendSuccess(res, { data: { ...quest, id: quest._id?.toString() } }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Delete quest (admin)
 * DELETE /api/quests/:id
 */
export const deleteQuest = async (req, res, next) => {
  try {
    const deleted = await Quest.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Quest not found' }, req)
    }
    return sendSuccess(res, { message: 'Deleted' }, req)
  } catch (error) {
    next(error)
  }
}

