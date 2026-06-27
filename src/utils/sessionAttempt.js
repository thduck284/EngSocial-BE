export function isWritingAttempt(att) {
  if (!att) return false
  return att.type === 'writing' || (att.submission?.content != null && !Array.isArray(att.answers))
}

export function sessionCutoffMs(sessionCompletedAt) {
  return new Date(sessionCompletedAt).getTime() + 5 * 60 * 1000
}

/**
 * Cửa sổ thời gian attempt thuộc phiên mock test:
 * từ lần nộp quiz đầu tiên trong phiên → completedAt + 5 phút.
 */
export function resolveSessionAttemptWindow(sessionParts = [], sessionCompletedAt) {
  const endMs = sessionCutoffMs(sessionCompletedAt)
  let startMs = null

  for (const progress of sessionParts) {
    const skill = progress?.lessonId?.skill
    if (skill === 'writing') continue

    const attempts = Array.isArray(progress?.attemptHistory) ? progress.attemptHistory : []
    let bestT = -1
    for (const att of attempts) {
      if (isWritingAttempt(att)) continue
      if (!Array.isArray(att.answers) || att.answers.length === 0) continue
      const t = att.submittedAt ? new Date(att.submittedAt).getTime() : 0
      if (t <= endMs && t > bestT) bestT = t
    }
    if (bestT >= 0) {
      startMs = startMs == null ? bestT : Math.min(startMs, bestT)
    }
  }

  if (startMs == null) startMs = endMs - 4 * 60 * 60 * 1000
  return { startMs: startMs - 2 * 60 * 1000, endMs }
}

export function isAttemptInSessionWindow(att, window) {
  if (!att || !window) return true
  const t = att.submittedAt ? new Date(att.submittedAt).getTime() : 0
  return t >= window.startMs && t <= window.endMs
}

/**
 * Attempt thuộc một phiên mock test.
 * Chỉ lấy attempt trong cửa sổ phiên (start → completedAt + 5 phút).
 */
export function pickSessionAttempt(progress, skill, sessionCompletedAt, attemptWindow = null) {
  const attempts = Array.isArray(progress?.attemptHistory) ? progress.attemptHistory : []
  const cutoffMs = attemptWindow?.endMs ?? (sessionCompletedAt ? sessionCutoffMs(sessionCompletedAt) : null)
  const windowStartMs = attemptWindow?.startMs ?? null

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
    if (windowStartMs != null && t < windowStartMs) continue
    if (t <= cutoffMs && t >= chosenTime) {
      chosen = att
      chosenTime = t
    }
  }
  return chosen
}

export function submissionContentFromAttempt(att) {
  return att?.submission?.content?.trim() || ''
}
