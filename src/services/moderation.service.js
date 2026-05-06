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

/**
 * Kiểm tra xem nội dung có vi phạm không.
 * Ném lỗi CONTENT_VIOLATION nếu bị phát hiện vi phạm.
 * @param {string} text
 * @param {{ threshold?: number, block?: boolean }} options
 *   - threshold: ngưỡng violation_score để chặn (mặc định 70)
 *   - block: true = ném lỗi chặn bài; false = chỉ gắn nhãn (mặc định true)
 */
export async function checkAndThrowIfViolation(text, { threshold = 70, block = true } = {}) {
  const result = await moderateText(text)
  if (!result) return { checked: false, result: null }

  const violated =
    result.is_violation === true && (result.violation_score ?? 0) >= threshold

  if (violated && block) {
    const err = new Error('CONTENT_VIOLATION')
    err.moderationResult = result
    throw err
  }

  return { checked: true, violated, result }
}
