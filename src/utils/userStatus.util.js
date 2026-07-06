export const STATUS_DURATION_UNITS = ['day', 'week', 'month', 'year']

export function isRestrictedStatus(status) {
  return status === 'inactive' || status === 'banned'
}

export function computeStatusUntil(fromDate, value, unit) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1 || !STATUS_DURATION_UNITS.includes(unit)) return null
  const d = new Date(fromDate instanceof Date ? fromDate : Date.now())
  switch (unit) {
    case 'day':
      d.setDate(d.getDate() + n)
      break
    case 'week':
      d.setDate(d.getDate() + n * 7)
      break
    case 'month':
      d.setMonth(d.getMonth() + n)
      break
    case 'year':
      d.setFullYear(d.getFullYear() + n)
      break
    default:
      return null
  }
  return d
}

/** Nếu khóa/tạm ngưng đã hết hạn → active và xóa statusUntil. */
export async function reactivateUserIfExpired(userDoc) {
  if (!userDoc) return userDoc
  if (!isRestrictedStatus(userDoc.status)) return userDoc
  if (!userDoc.statusUntil) return userDoc
  if (userDoc.statusUntil > new Date()) return userDoc
  userDoc.status = 'active'
  userDoc.statusUntil = null
  await userDoc.save()
  return userDoc
}

export async function loadUserAndReactivateIfExpired(userId) {
  const { User } = await import('../models/index.js')
  const user = await User.findById(userId)
  if (!user) return null
  return reactivateUserIfExpired(user)
}

export function formatStatusUntilForEmail(statusUntil, lang = 'vi') {
  if (!statusUntil) return ''
  const locale = lang === 'en' ? 'en-US' : 'vi-VN'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(statusUntil))
}
