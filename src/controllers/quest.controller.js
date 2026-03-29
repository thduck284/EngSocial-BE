import Quest from '../models/gamification/Quest.js'
import { sendSuccess, sendError } from '../dto/index.js'

function normalizeCondition(body = {}) {
  const conditionBody = body.condition || {}
  return {
    target: conditionBody.target ?? body.targetValue ?? 1,
    filters: {
      skill: conditionBody.filters?.skill ?? body.skill ?? 'all',
      category: conditionBody.filters?.category ?? 'all',
      minProgress: conditionBody.filters?.minProgress ?? 100,
      minScorePercent: conditionBody.filters?.minScorePercent ?? 0,
    },
  }
}

/**
 * Get quests list - from DB
 * GET /api/quests?type=daily&status=active
 */
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
    if (body.condition || body.targetValue != null || body.skill) {
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

/**
 * Get friends online & achievements - placeholder (from DB later)
 */
export const getFriends = async (req, res) => {
  return sendSuccess(res, { data: { friendsOnline: [], achievementsBySkill: {} } }, req)
}

/**
 * Get notifications - placeholder (from DB later)
 */
export const getNotifications = async (req, res) => {
  return sendSuccess(res, { data: [] }, req)
}

/**
 * Get chatbot - placeholder (from DB later)
 */
export const getChatbot = async (req, res) => {
  return sendSuccess(res, { data: { conversations: [], messages: [] } }, req)
}
