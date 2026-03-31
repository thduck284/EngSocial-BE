import mongoose from 'mongoose'
import { WordScrambleWord } from '../models/index.js'
import {
  inferWordScrambleDifficultyFromLength,
  normalizeWordScrambleDifficulty,
  parseWordScrambleTsv,
} from '../utils/wordScrambleTsv.js'

/**
 * @param {{ page?: number, limit?: number, difficulty?: string, topic?: string, q?: string, includeInactive?: boolean }} query
 */
export async function listWords(query) {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1)
  const limit = Math.min(500, Math.max(1, parseInt(String(query.limit || 100), 10) || 100))
  const filter = {}

  if (!query.includeInactive) {
    filter.isActive = true
  }
  if (query.difficulty && ['easy', 'medium', 'hard'].includes(query.difficulty)) {
    filter.difficulty = query.difficulty
  }
  if (query.topic != null && String(query.topic).trim()) {
    filter.topic = new RegExp(`^${escapeRegex(String(query.topic).trim())}$`, 'i')
  }
  if (query.q != null && String(query.q).trim()) {
    const s = String(query.q).trim()
    filter.$or = [
      { word: new RegExp(escapeRegex(s), 'i') },
      { meaning: new RegExp(escapeRegex(s), 'i') },
    ]
  }

  const [total, items] = await Promise.all([
    WordScrambleWord.countDocuments(filter),
    WordScrambleWord.find(filter)
      .sort({ word: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    items: items.map(serializeWord),
    total,
    page,
    limit,
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function serializeWord(doc) {
  return {
    id: doc._id.toString(),
    word: doc.word,
    meaning: doc.meaning,
    example: doc.example || '',
    difficulty: doc.difficulty,
    topic: doc.topic || '',
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/**
 * @param {{ word: string, meaning: string, example?: string, difficulty: string, topic?: string }} body
 */
export async function createWord(body) {
  const word = String(body.word || '').trim().toLowerCase()
  const exists = await WordScrambleWord.findOne({ word }).lean()
  if (exists) {
    const err = new Error('Word already exists')
    err.statusCode = 409
    throw err
  }
  const doc = await WordScrambleWord.create({
    word,
    meaning: String(body.meaning || '').trim(),
    example: String(body.example || '').trim(),
    difficulty: body.difficulty,
    topic: String(body.topic || '').trim(),
    isActive: body.isActive !== false,
  })
  return serializeWord(doc.toObject())
}

/**
 * @param {string} id
 * @param {object} body
 */
export async function updateWord(id, body) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid id')
    err.statusCode = 400
    throw err
  }
  const doc = await WordScrambleWord.findById(id)
  if (!doc) {
    const err = new Error('Not found')
    err.statusCode = 404
    throw err
  }

  if (body.word != null) {
    const w = String(body.word).trim().toLowerCase()
    const other = await WordScrambleWord.findOne({ word: w, _id: { $ne: doc._id } }).lean()
    if (other) {
      const err = new Error('Word already exists')
      err.statusCode = 409
      throw err
    }
    doc.word = w
  }
  if (body.meaning != null) doc.meaning = String(body.meaning).trim()
  if (body.example != null) doc.example = String(body.example).trim()
  if (body.difficulty != null) doc.difficulty = body.difficulty
  if (body.topic != null) doc.topic = String(body.topic).trim()
  if (body.isActive != null) doc.isActive = !!body.isActive

  await doc.save()
  return serializeWord(doc.toObject())
}

export async function deleteWord(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid id')
    err.statusCode = 400
    throw err
  }
  const res = await WordScrambleWord.findByIdAndDelete(id)
  if (!res) {
    const err = new Error('Not found')
    err.statusCode = 404
    throw err
  }
  return { ok: true }
}

/** Xóa toàn bộ từ Word Scramble (moderator/admin). */
export async function deleteAllWords() {
  const r = await WordScrambleWord.deleteMany({})
  return { deletedCount: r.deletedCount ?? 0 }
}

/**
 * Random một từ cho game (chỉ isActive).
 * @param {{ difficulty: string, topic?: string }} opts
 */
/**
 * Import nhanh: paste nguyên file TSV (có dòng tiêu đề). Trùng `word` → cập nhật.
 * @param {string} rawText
 */
export async function importWordsFromTsv(rawText) {
  const parsed = parseWordScrambleTsv(String(rawText || ''))
  const errors = []
  const seenInFile = new Set()
  /** @type {{ word: string, meaning: string, example: string, difficulty: string, topic: string }[]} */
  const batch = []

  for (let i = 0; i < parsed.length; i++) {
    const lineNum = i + 2
    const row = parsed[i]
    const raw = String(row.word || '').trim()
    if (!raw || /\s/.test(raw) || !/^[a-zA-Z]+$/.test(raw) || raw.length < 3) {
      errors.push({ line: lineNum, word: raw || '(empty)', reason: 'invalid_word' })
      continue
    }
    const low = raw.toLowerCase()
    if (seenInFile.has(low)) {
      errors.push({ line: lineNum, word: low, reason: 'duplicate_in_file' })
      continue
    }
    seenInFile.add(low)

    const meaning = String(row.meaning || '').trim()
    if (!meaning) {
      errors.push({ line: lineNum, word: low, reason: 'missing_meaning' })
      continue
    }

    const tier =
      normalizeWordScrambleDifficulty(row.difficulty) ||
      inferWordScrambleDifficultyFromLength(low.length)

    batch.push({
      word: low,
      meaning,
      example: String(row.example || '').trim(),
      difficulty: tier,
      topic: String(row.topic || '').trim(),
    })
  }

  if (batch.length === 0) {
    return {
      upserted: 0,
      modified: 0,
      matched: 0,
      rowsInFile: parsed.length,
      validForWrite: 0,
      rowErrors: errors.slice(0, 100),
    }
  }

  const ops = batch.map((doc) => ({
    updateOne: {
      filter: { word: doc.word },
      update: {
        $set: {
          word: doc.word,
          meaning: doc.meaning,
          example: doc.example,
          difficulty: doc.difficulty,
          topic: doc.topic,
          isActive: true,
        },
      },
      upsert: true,
    },
  }))

  const result = await WordScrambleWord.bulkWrite(ops, { ordered: false })

  return {
    upserted: result.upsertedCount ?? 0,
    modified: result.modifiedCount ?? 0,
    matched: result.matchedCount ?? 0,
    rowsInFile: parsed.length,
    validForWrite: batch.length,
    rowErrors: errors.slice(0, 100),
  }
}

export async function getRandomWord(opts) {
  const { difficulty, topic } = opts
  if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
    return null
  }
  const match = { isActive: true, difficulty }
  if (topic != null && String(topic).trim()) {
    match.topic = new RegExp(`^${escapeRegex(String(topic).trim())}$`, 'i')
  }

  const agg = await WordScrambleWord.aggregate([{ $match: match }, { $sample: { size: 1 } }])
  if (!agg.length) return null
  const doc = agg[0]
  return {
    word: doc.word,
    meaning: doc.meaning,
    example: doc.example || undefined,
    difficulty: doc.difficulty,
    topic: doc.topic || '',
  }
}
