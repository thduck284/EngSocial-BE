import Quest from '../models/gamification/Quest.js'
import UserQuestProgress from '../models/gamification/UserQuestProgress.js'

const STATIC_PERIOD_KEY = '_'

export function pickEffectiveTarget(targetMin, targetMax) {
  const lo = Math.min(targetMin, targetMax)
  const hi = Math.max(targetMin, targetMax)
  if (lo === hi) return lo
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

export function readTargetBounds(condition = {}) {
  let targetMin = Number(condition.targetMin ?? condition.target ?? 1)
  if (!Number.isFinite(targetMin) || targetMin < 1) targetMin = 1
  let targetMax = Number(condition.targetMax ?? condition.target ?? targetMin)
  if (!Number.isFinite(targetMax) || targetMax < 1) targetMax = targetMin
  if (targetMax < targetMin) targetMax = targetMin
  return { targetMin, targetMax }
}

/**
 * Đảm bảo có bản ghi tiến độ; tạo mới nếu chưa có (effectiveTarget random trong [min,max] nếu là range).
 */
export async function ensureUserQuestProgress(userId, quest) {
  const cond = quest.condition || {}
  const { targetMin, targetMax } = readTargetBounds(cond)

  let doc = await UserQuestProgress.findOne({ userId, questId: quest._id })
  if (!doc) {
    const effectiveTarget = pickEffectiveTarget(targetMin, targetMax)
    doc = await UserQuestProgress.create({
      userId,
      questId: quest._id,
      periodKey: STATIC_PERIOD_KEY,
      currentCount: 0,
      effectiveTarget,
    })
    return doc
  }

  return doc
}

/**
 * Tăng bộ đếm (gọi từ hook nghiệp vụ sau này).
 */
export async function incrementUserQuestProgress(userId, questId, inc = 1) {
  const quest = await Quest.findById(questId).lean()
  if (!quest) throw new Error('QUEST_NOT_FOUND')
  await ensureUserQuestProgress(userId, quest)
  return UserQuestProgress.findOneAndUpdate(
    { userId, questId },
    { $inc: { currentCount: inc } },
    { new: true }
  ).lean()
}

/**
 * Danh sách quest active + tiến độ cho user.
 */
export async function listMyQuestProgress(userId, { status = 'active' } = {}) {
  const quests = await Quest.find({ status })
    .sort({ order: 1, createdAt: -1 })
    .lean()

  const out = []
  for (const q of quests) {
    const progress = await ensureUserQuestProgress(userId, q)
    out.push({
      quest: { ...q, id: q._id?.toString() },
      progress: {
        currentCount: progress.currentCount,
        effectiveTarget: progress.effectiveTarget,
        periodKey: progress.periodKey,
      },
    })
  }
  return out
}
