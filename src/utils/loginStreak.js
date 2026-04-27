export const isSameDay = (a, b) =>
  a instanceof Date &&
  b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

function calendarDaysBetween(prev, now) {
  const a = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * Gọi khi user đăng nhập / social login thành công.
 * Cập nhật `lastActiveDate`, chuỗi `streak` / `longestStreak` theo ngày lịch (server local).
 * @returns {{ calendarAdvance: boolean }} true = ngày mới so với lần active trước → bump quest/challenge
 */
export function updateUserStreakOnLogin(user, now = new Date()) {
  const last = user.lastActiveDate ? new Date(user.lastActiveDate) : null
  if (last && isSameDay(last, now)) {
    user.lastActiveDate = now
    return { calendarAdvance: false }
  }
  if (!last) {
    user.streak = 1
  } else {
    const gap = calendarDaysBetween(last, now)
    if (gap === 1) user.streak = (Number(user.streak) || 0) + 1
    else user.streak = 1
  }
  if ((user.streak || 0) > (Number(user.longestStreak) || 0)) {
    user.longestStreak = user.streak
  }
  user.lastActiveDate = now
  return { calendarAdvance: true }
}
