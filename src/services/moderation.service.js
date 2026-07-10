/**
 * moderation.service.js
 * Gọi AI moderation API để kiểm duyệt nội dung bài viết.
 * URL lấy từ env: MODERATION_APP
 */

import { Agent, fetch as undiciFetch } from 'undici'

const MODERATION_URL = (process.env.MODERATION_APP || '').trim()

let _moderationTlsAgent = null

function isNgrokHost(url) {
  return /ngrok/i.test(url || '')
}

function moderationTlsInsecureEnabled() {
  const modFlag = (process.env.MODERATION_TLS_INSECURE || '').trim().toLowerCase()
  if (modFlag === '0' || modFlag === 'false' || modFlag === 'no') return false
  if (modFlag === '1' || modFlag === 'true' || modFlag === 'yes') return true

  const sharedFlag = (process.env.CHAT_BOT_TLS_INSECURE || '').trim().toLowerCase()
  if (sharedFlag === '1' || sharedFlag === 'true' || sharedFlag === 'yes') return true

  return isNgrokHost(MODERATION_URL)
}

function moderationTlsAgent() {
  if (!moderationTlsInsecureEnabled()) return null
  if (!_moderationTlsAgent) {
    _moderationTlsAgent = new Agent({
      connect: { rejectUnauthorized: false },
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
    })
  }
  return _moderationTlsAgent
}

function moderationFetch(url, init = {}) {
  const agent = moderationTlsAgent()
  if (agent) {
    return undiciFetch(url, { ...init, dispatcher: agent })
  }
  return fetch(url, init)
}

function moderationAbortSignal(timeoutMs) {
  const ms = Math.max(0, Number(timeoutMs) || 0)
  if (!ms) return undefined
  if (typeof AbortSignal.timeout === 'function') {
    try {
      return AbortSignal.timeout(ms)
    } catch {
      /* fall through */
    }
  }
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  if (typeof timer.unref === 'function') timer.unref()
  return ac.signal
}

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

  const headers = { 'Content-Type': 'application/json' }
  if (isNgrokHost(MODERATION_URL)) {
    headers['ngrok-skip-browser-warning'] = '69420'
  }

  try {
    const res = await moderationFetch(MODERATION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: text.trim() }),
      signal: moderationAbortSignal(8000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[moderation] API trả về lỗi: ${res.status}`, errText.slice(0, 200))
      return null
    }

    const result = await res.json()
    return result
  } catch (err) {
    const detail = err?.cause?.message || err?.message || String(err)
    console.warn('[moderation] Không thể gọi AI moderation:', detail)
    if (/unable to verify|UNABLE_TO_VERIFY|certificate/i.test(detail)) {
      console.warn('[moderation] Gợi ý: đặt MODERATION_TLS_INSECURE=1 hoặc CHAT_BOT_TLS_INSECURE=1 khi dùng ngrok.')
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|AbortError/i.test(detail)) {
      console.warn('[moderation] Gợi ý: kiểm tra ai-safe-post đang chạy và cập nhật URL ngrok mới vào MODERATION_APP.')
    }
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
