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

  // Auto detect separator: tab or comma
  let separator = '\t'
  if (headerLine.includes('\t')) {
    separator = '\t'
  } else if (headerLine.includes(',')) {
    separator = ','
  }

  const header = headerLine.split(separator).map((c) => c.trim().toLowerCase())
  const iWord = header.indexOf('word')
  const iMean = header.indexOf('meaning')
  const iEx = header.indexOf('example')
  const iDiff = header.indexOf('difficulty')
  const iTopic = header.indexOf('topic')
  const iSyns = header.indexOf('synonyms')
  const iAnts = header.indexOf('antonyms')
  const iTmpl = header.indexOf('sentencetemplate') // lowercase header matching
  const iWrSent = header.indexOf('wrongsentence')
  const iWrWord = header.indexOf('wrongword')
  
  if (iWord < 0 || iMean < 0) return []

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    
    // Split by separator, but handle simple CSV wrapping quotes if CSV
    let cols = []
    if (separator === ',') {
      // Basic CSV splitter that handles quotes
      cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    } else {
      cols = line.split('\t')
    }

    const cleanCell = (val) => {
      let s = (val || '').trim()
      if (s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1).replace(/""/g, '"').trim()
      }
      return s
    }

    const word = cleanCell(cols[iWord])
    const meaning = cleanCell(cols[iMean])
    const example = iEx >= 0 ? cleanCell(cols[iEx]) : ''
    const diffRaw = iDiff >= 0 ? cleanCell(cols[iDiff]) : ''
    const topicRaw = iTopic >= 0 ? cleanCell(cols[iTopic]) : ''
    const synsRaw = iSyns >= 0 ? cleanCell(cols[iSyns]) : ''
    const antsRaw = iAnts >= 0 ? cleanCell(cols[iAnts]) : ''
    const tmplRaw = iTmpl >= 0 ? cleanCell(cols[iTmpl]) : ''
    const wrSentRaw = iWrSent >= 0 ? cleanCell(cols[iWrSent]) : ''
    const wrWordRaw = iWrWord >= 0 ? cleanCell(cols[iWrWord]) : ''
    
    if (!word) continue
    const row = { word, meaning }
    if (example) row.example = example
    if (diffRaw) row.difficulty = diffRaw
    if (topicRaw) row.topic = topicRaw
    
    if (synsRaw) {
      row.synonyms = synsRaw.split(',').map(s => s.trim()).filter(Boolean)
    }
    if (antsRaw) {
      row.antonyms = antsRaw.split(',').map(a => a.trim()).filter(Boolean)
    }
    if (tmplRaw) row.sentenceTemplate = tmplRaw
    if (wrSentRaw) row.wrongSentence = wrSentRaw
    if (wrWordRaw) row.wrongWord = wrWordRaw
    
    rows.push(row)
  }
  return rows
}
