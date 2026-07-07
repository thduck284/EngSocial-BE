/**
 * Base URL FE dùng trong email (xác minh, đặt lại mật khẩu, ...).
 * Ưu tiên FRONTEND_URL → origin HTTPS deploy (Render/Vercel) → origin đầu CORS_ORIGIN.
 */
export function getFrontendBaseUrl() {
  const explicit = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '')
  if (explicit) return explicit

  const origins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const deployed = origins.find(
    (o) => /^https:\/\//i.test(o) && !/localhost|127\.0\.0\.1/i.test(o),
  )
  if (deployed) return deployed.replace(/\/$/, '')

  return (origins[0] || '').replace(/\/$/, '')
}

export function buildFrontendUrl(path) {
  const base = getFrontendBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}
