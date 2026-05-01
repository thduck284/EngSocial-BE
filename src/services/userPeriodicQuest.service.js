import mongoose from 'mongoose'
import UserPeriodicQuest from '../models/gamification/UserPeriodicQuest.js'
import PeriodicQuestPool from '../models/gamification/PeriodicQuestPool.js'
import { User } from '../models/index.js'

/** Số slot cố định mỗi kỳ — random chọn bấy nhiêu mục từ PeriodicQuestPool. */
export const PERIODIC_SLOT_COUNTS = { daily: 3, weekly: 5 }

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function dailyPeriodKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function getISOWeekNumber(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return { weekNo, year: date.getUTCFullYear() }
}

export function weeklyPeriodKey(d = new Date()) {
  const { weekNo, year } = getISOWeekNumber(d)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

export function currentPeriodKey(periodType, d = new Date()) {
  if (periodType === 'daily') return dailyPeriodKey(d)
  if (periodType === 'weekly') return weeklyPeriodKey(d)
  return dailyPeriodKey(d)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickEffectiveTarget(targetMin, targetMax) {
  const lo = Math.min(targetMin, targetMax)
  const hi = Math.max(targetMin, targetMax)
  if (lo === hi) return lo
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

async function purgeStalePeriods(userId, now = new Date()) {
  // We no longer delete stale periods to keep history as requested.
  // The frontend and backend already filter by the current periodKey.
  return
}

function poolRowToTemplate(row) {
  return {
    _id: row._id,
    category: row.category,
    skill: row.skill || 'all',
    minScorePercent: row.minScorePercent ?? 0,
    targetMin: row.targetMin,
    targetMax: row.targetMax,
    xpReward: row.xpReward ?? 50,
    icon: row.icon || 'flag',
  }
}

/**
 * Lấy ngẫu nhiên `count` mục từ kho DB (xáo trộn; nếu kho ít hơn count thì lặp lại mục).
 */
async function samplePoolEntries(periodType, count, excludePoolIds = []) {
  const filter = { periodType, status: 'active' }
  if (excludePoolIds && excludePoolIds.length > 0) {
    const objectIds = excludePoolIds.map((id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id))
    filter._id = { $nin: objectIds }
  }

  let pool = await PeriodicQuestPool.find(filter).lean()

  // If filtered pool is too small, fallback to full pool but keep shuffle
  if (pool.length < count) {
    pool = await PeriodicQuestPool.find({ periodType, status: 'active' }).lean()
  }

  if (!pool.length) return []
  const shuffled = shuffle(pool)

  if (shuffled.length >= count) {
    return shuffled.slice(0, count).map(poolRowToTemplate)
  }
  const out = shuffled.map(poolRowToTemplate)
  let i = 0
  while (out.length < count) {
    out.push(poolRowToTemplate(pool[i % pool.length]))
    i++
  }
  return out.slice(0, count)
}

async function ensureSlotsForPeriod(userId, periodType, now = new Date()) {
  const need = PERIODIC_SLOT_COUNTS[periodType] ?? 0
  const periodKey = currentPeriodKey(periodType, now)

  const mid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
  const existing = await UserPeriodicQuest.find({ userId: mid, periodType, periodKey })
    .sort({ slotIndex: 1 })
    .lean()
  if (existing.length >= need) return

  // Logic "Làm mới": Lấy template của kỳ trước để loại trừ, đảm bảo bốc ra quest khác
  let prevKey = ''
  if (periodType === 'daily') {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    prevKey = dailyPeriodKey(d)
  } else {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    prevKey = weeklyPeriodKey(d)
  }

  const prevDocs = await UserPeriodicQuest.find({ userId: mid, periodType, periodKey: prevKey }).select('poolEntryId').lean()
  const excludePoolIds = prevDocs.map((d) => d.poolEntryId).filter(Boolean)

  const picks = await samplePoolEntries(periodType, need, excludePoolIds)
  if (!picks.length) {
    console.warn(`[userPeriodicQuest] PeriodicQuestPool trống cho periodType=${periodType}. Chạy: npm run db:seed:quest-pool`)
    return
  }

  const existingSlot = new Set(existing.map((e) => e.slotIndex))
  let pickCursor = 0

  for (let slotIndex = 0; slotIndex < need; slotIndex++) {
    if (existingSlot.has(slotIndex)) continue

    const hasDoc = await UserPeriodicQuest.findOne({ userId: mid, periodType, periodKey, slotIndex })
    if (hasDoc) continue

    const tpl = picks[pickCursor % picks.length]
    pickCursor++

    const effectiveTarget = pickEffectiveTarget(tpl.targetMin, tpl.targetMax)

    try {
      await UserPeriodicQuest.create({
        userId: mid,
        periodType,
        periodKey,
        slotIndex,
        title: '',
        description: '',
        category: tpl.category,
        skill: tpl.skill || 'all',
        minScorePercent: tpl.minScorePercent ?? 0,
        targetMin: tpl.targetMin,
        targetMax: tpl.targetMax,
        effectiveTarget,
        currentCount: 0,
        xpReward: tpl.xpReward ?? 50,
        icon: tpl.icon || 'flag',
        completed: false,
        poolEntryId: tpl._id,
      })
    } catch (e) {
      if (e?.code === 11000) continue
      throw e
    }
  }
}

/**
 * Đảm bảo đủ slot theo kỳ; xóa bản ghi kỳ cũ. Quest đã tạo cho user + periodKey giữ nguyên, không tạo lại.
 */
export async function ensureUserPeriodicQuests(userId, now = new Date()) {
  await purgeStalePeriods(userId, now)
  await ensureSlotsForPeriod(userId, 'daily', now)
  await ensureSlotsForPeriod(userId, 'weekly', now)

  const dk = currentPeriodKey('daily', now)
  const wk = currentPeriodKey('weekly', now)

  const docs = await UserPeriodicQuest.find({
    userId,
    $or: [
      { periodType: 'daily', periodKey: dk },
      { periodType: 'weekly', periodKey: wk },
    ],
  }).lean()

  const typeOrder = { daily: 0, weekly: 1 }
  docs.sort((a, b) => (typeOrder[a.periodType] ?? 9) - (typeOrder[b.periodType] ?? 9) || a.slotIndex - b.slotIndex)
  return docs
}

/**
 * Cộng tiến độ một quest cụ thể; khi đạt target lần đầu → completed + awardXp (quest XP, tách với XP bài học).
 * Quest đã completed: không tăng thêm (giữ trạng thái đến kỳ reset).
 */
export async function applyPeriodicQuestIncrement(userId, periodicQuestId, delta = 1) {
  const uid = typeof userId === 'string' ? userId : userId.toString()
  const qid = typeof periodicQuestId === 'string' ? periodicQuestId : periodicQuestId.toString()

  const existing = await UserPeriodicQuest.findOne({ _id: qid, userId: uid }).lean()
  if (!existing || existing.completed) return existing

  const next = Math.min(existing.effectiveTarget, existing.currentCount + delta)
  const willComplete = next >= existing.effectiveTarget

  const updated = await UserPeriodicQuest.findOneAndUpdate(
    { _id: qid, userId: uid, completed: false },
    { $set: { currentCount: next, ...(willComplete ? { completed: true } : {}) } },
    { new: true }
  ).lean()

  if (willComplete && updated?.completed && (updated.xpReward ?? 0) > 0) {
    const user = await User.findById(uid)
    if (user) {
      user.awardXp(updated.xpReward)
      await user.save()
    }
  }

  return updated
}

/** @deprecated Dùng applyPeriodicQuestIncrement — giữ tên cũ cho code gọi trực tiếp id */
export async function incrementUserPeriodicQuest(userId, periodicQuestId, delta = 1) {
  return applyPeriodicQuestIncrement(userId, periodicQuestId, delta)
}

/**
 * Tăng +delta cho mọi quest chu kỳ hiện tại (daily/weekly) trùng category (và skill / ngưỡng điểm nếu có).
 */
export async function incrementPeriodicQuestsForCategory(userId, category, delta = 1, options = {}) {
  const { skill = null, scorePercent = null } = options
  const uid = typeof userId === 'string' ? userId : userId.toString()
  const now = new Date()
  const dk = currentPeriodKey('daily', now)
  const wk = currentPeriodKey('weekly', now)

  const periodOr = [
    { periodType: 'daily', periodKey: dk },
    { periodType: 'weekly', periodKey: wk },
  ]

  const base = {
    userId: uid,
    completed: false,
    category,
    $or: periodOr,
  }

  const andClauses = []
  if (skill && ['lesson', 'practice', 'all'].includes(category)) {
    andClauses.push({ $or: [{ skill: 'all' }, { skill }] })
  }
  if (scorePercent != null && Number.isFinite(Number(scorePercent))) {
    const sp = Number(scorePercent)
    andClauses.push({ minScorePercent: { $lte: sp } })
  }
  if (andClauses.length) base.$and = andClauses

  const quests = await UserPeriodicQuest.find(base).sort({ periodType: 1, slotIndex: 1 }).lean()
  for (const q of quests) {
    await applyPeriodicQuestIncrement(uid, q._id, delta)
  }
}

/** Sau khi hoàn thành bài học/luyện tập: đếm cho category tương ứng (lesson|practice) + all */
export async function bumpPeriodicQuestsOnLessonEvent(userId, lessonSkill, scorePercent, lessonCategory = 'lesson') {
  const skill = lessonSkill && ['reading', 'listening', 'writing'].includes(lessonSkill) ? lessonSkill : 'reading'
  const sp = scorePercent != null ? Number(scorePercent) : 100
  const category = ['lesson', 'practice'].includes(lessonCategory) ? lessonCategory : 'lesson'
  await incrementPeriodicQuestsForCategory(userId, category, 1, { skill, scorePercent: sp })
  await incrementPeriodicQuestsForCategory(userId, 'all', 1, { skill, scorePercent: sp })
}

/** Sau khi user tạo/sửa note từ màn vocab. */
export async function bumpPeriodicQuestsOnVocabularyNoteEvent(userId) {
  await incrementPeriodicQuestsForCategory(userId, 'vocabulary_notes', 1)
  await incrementPeriodicQuestsForCategory(userId, 'all', 1)
}

/** Sau khi user đăng nhập (streak/login engagement). */
export async function bumpPeriodicQuestsOnLoginStreakEvent(userId) {
  await incrementPeriodicQuestsForCategory(userId, 'login_streak', 1)
  await incrementPeriodicQuestsForCategory(userId, 'all', 1)
}

/** Tick thời gian online (delta theo phút hoặc đơn vị hệ thống gọi). */
export async function bumpPeriodicQuestsOnOnlineTimeEvent(userId, delta = 1) {
  await incrementPeriodicQuestsForCategory(userId, 'online_time', delta)
  await incrementPeriodicQuestsForCategory(userId, 'all', delta)
}

export function serializePeriodicQuestForClient(doc) {
  const id = doc._id?.toString()
  return {
    id,
    type: doc.periodType,
    xpReward: doc.xpReward,
    icon: doc.icon,
    condition: {
      target: doc.effectiveTarget,
      targetMin: doc.targetMin,
      targetMax: doc.targetMax,
      filters: {
        category: doc.category,
        skill: doc.skill,
        minScorePercent: doc.minScorePercent,
      },
    },
    userProgress: {
      currentCount: doc.currentCount,
      effectiveTarget: doc.effectiveTarget,
    },
    completed: doc.completed,
    periodKey: doc.periodKey,
    slotIndex: doc.slotIndex,
    poolEntryId: doc.poolEntryId?.toString?.() ?? doc.poolEntryId,
  }
}
