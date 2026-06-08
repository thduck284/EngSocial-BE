export function isWritingAttempt(att) {
  if (!att) return false
  return att.type === 'writing' || (att.submission?.content != null && !Array.isArray(att.answers))
}

/**
 * Attempt thuộc một phiên mock test (theo thời gian nộp ≤ sessionCompletedAt + 5 phút).
 * Bỏ qua các lần làm lại sau mock test.
 */
export function pickSessionAttempt(progress, skill, sessionCompletedAt) {
  const attempts = Array.isArray(progress?.attemptHistory) ? progress.attemptHistory : []
  const cutoffMs = sessionCompletedAt
    ? new Date(sessionCompletedAt).getTime() + 5 * 60 * 1000
    : null

  const filtered = attempts.filter((att) => {
    if (skill === 'writing') return isWritingAttempt(att)
    return att.type === 'quiz' || (Array.isArray(att.answers) && !isWritingAttempt(att))
  })

  if (filtered.length === 0) return null
  if (!cutoffMs) return filtered[filtered.length - 1]

  let chosen = null
  let chosenTime = -1
  for (const att of filtered) {
    const t = att.submittedAt ? new Date(att.submittedAt).getTime() : 0
    if (t <= cutoffMs && t >= chosenTime) {
      chosen = att
      chosenTime = t
    }
  }
  return chosen || filtered[filtered.length - 1]
}

export function submissionContentFromAttempt(att) {
  return att?.submission?.content?.trim() || ''
}
