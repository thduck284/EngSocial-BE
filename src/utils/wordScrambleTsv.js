/**
 * Parse TSV giống FE `wordScrambleWords.js` — dùng import nhanh từ clipboard/file.
 * Cột: word, meaning, example (optional), difficulty (optional), topic (optional).
 */

export function normalizeWordScrambleDifficulty(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'easy' || s === 'e') return 'easy'
  if (s === 'medium' || s === 'm' || s === 'normal') return 'medium'
  if (s === 'hard' || s === 'h' || s === 'difficult') return 'hard'
  return null
}

export function inferWordScrambleDifficultyFromLength(len) {
  if (len <= 5) return 'easy'
  if (len <= 7) return 'medium'
  return 'hard'
}

/**
 * @param {string} raw
 * @returns {{ word: string, meaning: string, example?: string, difficulty?: string, topic?: string }[]}
 */
export function parseWordScrambleTsv(raw) {
  const text = raw.replace(/^\uFEFF/, '').trim()
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const headerLine = lines[0]
  if (!headerLine) return []

  const header = headerLine.split('\t').map((c) => c.trim().toLowerCase())
  const iWord = header.indexOf('word')
  const iMean = header.indexOf('meaning')
  const iEx = header.indexOf('example')
  const iDiff = header.indexOf('difficulty')
  const iTopic = header.indexOf('topic')
  if (iWord < 0 || iMean < 0) return []

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    const word = (cols[iWord] || '').trim()
    const meaning = (cols[iMean] || '').trim()
    const example = iEx >= 0 ? (cols[iEx] || '').trim() : ''
    const diffRaw = iDiff >= 0 ? (cols[iDiff] || '').trim() : ''
    const topicRaw = iTopic >= 0 ? (cols[iTopic] || '').trim() : ''
    if (!word) continue
    const row = { word, meaning }
    if (example) row.example = example
    if (diffRaw) row.difficulty = diffRaw
    if (topicRaw) row.topic = topicRaw
    rows.push(row)
  }
  return rows
}
