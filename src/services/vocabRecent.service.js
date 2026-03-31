import UserVocabRecent, { VOCAB_PRACTICE_MODES } from '../models/learning/UserVocabRecent.js'

/** Khớp số chủ đề có sẵn trên FE (VOCAB_TOPIC_METAS.length) */
export const VOCAB_PRESET_TOPIC_COUNT = 16

const MAX_ITEMS = 12

function itemKey(item) {
  if (item.topicId === 'custom') {
    const d = (item.deck || '').trim()
    return `custom:${d || 'all'}`
  }
  return String(item.topicId)
}

function validatePayload({ topicId, practiceMode, deck }) {
  if (!VOCAB_PRACTICE_MODES.includes(practiceMode)) {
    return { ok: false, message: 'Invalid practiceMode' }
  }
  const tid = String(topicId || '').trim()
  if (tid === 'custom') {
    let d = deck
    if (d != null && d !== '') {
      d = String(d).trim()
      if (d.length > 120) return { ok: false, message: 'deck too long' }
    } else {
      d = null
    }
    return { ok: true, topicId: 'custom', practiceMode, deck: d }
  }
  if (!/^\d+$/.test(tid)) return { ok: false, message: 'Invalid topicId' }
  const n = parseInt(tid, 10)
  if (n < 1 || n > VOCAB_PRESET_TOPIC_COUNT) {
    return { ok: false, message: 'Invalid topicId' }
  }
  return { ok: true, topicId: tid, practiceMode, deck: null }
}

/**
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {{ topicId: string, practiceMode: string, deck?: string|null }} body
 */
export async function recordVocabRecentVisit(userId, body) {
  const v = validatePayload(body)
  if (!v.ok) {
    const err = new Error(v.message)
    err.statusCode = 400
    throw err
  }

  const entry = {
    topicId: v.topicId,
    practiceMode: v.practiceMode,
    deck: v.deck,
    visitedAt: new Date(),
  }

  let doc = await UserVocabRecent.findOne({ user: userId })
  if (!doc) {
    doc = new UserVocabRecent({ user: userId, items: [] })
  }

  const k = itemKey(entry)
  doc.items = doc.items.filter((x) => itemKey(x) !== k)
  doc.items.unshift(entry)
  doc.items = doc.items.slice(0, MAX_ITEMS)
  await doc.save()

  return doc.items.map((x) => ({
    topicId: x.topicId,
    practiceMode: x.practiceMode,
    deck: x.deck,
    visitedAt: x.visitedAt,
  }))
}

export async function getVocabRecentForUser(userId) {
  const doc = await UserVocabRecent.findOne({ user: userId }).lean()
  if (!doc?.items?.length) return []
  return doc.items.map((x) => ({
    topicId: x.topicId,
    practiceMode: x.practiceMode,
    deck: x.deck,
    visitedAt: x.visitedAt,
  }))
}
