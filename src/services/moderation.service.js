/**
 * moderation.service.js
 * Gọi AI moderation API để kiểm duyệt nội dung bài viết.
 * URL lấy từ env: MODERATION_APP
 */

const MODERATION_URL = process.env.MODERATION_APP

/**
 * Kiểm duyệt nội dung văn bản.
 * @param {string} text - Nội dung cần kiểm duyệt
 * @returns {{ is_violation: boolean, label: string, confidence: number, violation_score: number, keywords: string[] }}
 */
export async function moderateText(text) {
  if (!MODERATION_URL) {
    console.warn('[moderation] MODERATION_APP chưa được cấu hình trong .env')
    return null
  }

  if (!text || typeof text !== 'string' || !text.trim()) return null

  try {
    const res = await fetch(MODERATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
      signal: AbortSignal.timeout(8000), // timeout 8 giây
    })

    if (!res.ok) {
      console.warn(`[moderation] API trả về lỗi: ${res.status}`)
      return null
    }

    const result = await res.json()
    return result
  } catch (err) {
    // Không để lỗi moderation chặn việc đăng bài
    console.warn('[moderation] Không thể gọi AI moderation:', err?.message)
    return null
  }
}

export async function checkAndThrowIfViolation(text, { threshold = 50 } = {}) {
  const result = await moderateText(text)

  // AI không gọi được → bỏ qua kiểm duyệt, vẫn cho đăng bài
  if (!result) {
    return {
      checked: false,
      violated: false,
      skipped: true,
      result: {
        violationScore: 0,
        level: 'none',
        label: 'Không vi phạm',
        keywords: [],
      },
    }
  }

  const aiKeywords = result.keywords || []
  let score = result.violation_score ?? 0
  const isViol = result.is_violation || false

  // Nếu AI trả về is_violation là true hoặc mảng keywords có chứa từ khóa vi phạm
  // nhưng score bị trả về thấp (< threshold) do bộ lọc tự tin (confidence gate),
  // ta sẽ lấy score tối thiểu là 85% để đảm bảo bài viết này bị chặn đúng theo nhận diện của AI.
  if ((isViol || aiKeywords.length > 0) && score < threshold) {
    score = 85
  }

  let level = 'low'
  if (score >= 80) {
    level = 'high'
  } else if (score >= 50) {
    level = 'medium'
  }

  const formattedResult = {
    violationScore: score,
    level,
    label: result.label || (level !== 'low' ? 'Vi phạm tiêu chuẩn cộng đồng' : 'Không vi phạm'),
    keywords: aiKeywords,
    confidence: result.confidence ?? score,
  }

  // Chặn cả medium (score >= 50) và high (score >= 80)
  if (level === 'high' || level === 'medium') {
    const err = new Error('CONTENT_VIOLATION')
    err.moderationResult = formattedResult
    throw err
  }

  return { checked: true, violated: false, result: formattedResult }
}
