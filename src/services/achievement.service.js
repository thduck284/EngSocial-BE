import mongoose from 'mongoose'
import { Achievement, UserAchievement, User, UserLessonProgress } from '../models/index.js'

function maxGoalFromRequirement(req) {
  if (!req) return 0
  const ms = req.milestones
  if (Array.isArray(ms) && ms.length) {
    const vals = ms
      .map((m) => Number(m.value))
      .filter((n) => Number.isFinite(n) && n > 0)
    return vals.length ? Math.max(...vals) : 0
  }
  const v = Number(req.value)
  return Number.isFinite(v) && v > 0 ? v : 0
}

function derivedProgressForRequirement(req, user, completedLessons) {
  if (!req?.type || !user) return null
  const type = String(req.type)
  if (type === 'login_streak_days') return Number(user.streak) || 0
  if (type === 'lessons_completed') return Math.max(0, Number(completedLessons) || 0)
  if (type === 'xp_total') return Number(user.totalXp) || 0
  if (type === 'online_minutes') {
    return Math.max(0, Number(user.achievementStats?.onlineMinutes) || 0)
  }
  return null
}

/**
 * Get all active achievements with current user's unlock state.
 * GET /api/user/achievements (for current user).
 * `progress` gộp UserAchievement và số liệu thực tế (streak, bài học, totalXp, phút online) khi khớp `requirement.type`.
 */
export const getAchievementsForUser = async (userId) => {
  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId
  const [achievements, userAchievements, user, completedLessons] = await Promise.all([
    Achievement.find({ active: true }).sort({ order: 1, key: 1 }).lean(),
    UserAchievement.find({ userId: uid }).lean(),
    User.findById(uid).select('streak totalXp achievementStats').lean(),
    UserLessonProgress.countDocuments({ userId: uid, status: 'completed' }),
  ])
  const byAchievementId = new Map()
  userAchievements.forEach((ua) => {
    byAchievementId.set(ua.achievementId.toString(), ua)
  })
  return achievements.map((a) => {
    const id = a._id.toString()
    const uaDoc = byAchievementId.get(id)
    const uaProgress = Number(uaDoc?.progress) || 0
    const derived = derivedProgressForRequirement(a.requirement, user, completedLessons)
    const progress =
      derived != null ? Math.max(uaProgress, derived) : uaProgress
    const maxGoal = maxGoalFromRequirement(a.requirement)
    const completed = maxGoal > 0 ? progress >= maxGoal : !!uaDoc
    return {
      id,
      key: a.key,
      name: a.name,
      nameEn: a.nameEn,
      description: a.description,
      descriptionEn: a.descriptionEn,
      icon: a.icon,
      color: a.color,
      type: a.type,
      skill: a.skill,
      requirement: a.requirement,
      xpReward: a.xpReward ?? 0,
      rewardType: a.rewardType || 'both',
      badgeName: a.badgeName,
      badgeNameEn: a.badgeNameEn,
      badgeImage: a.badgeImage,
      badgeIcon: a.badgeIcon,
      rarity: a.rarity ?? 'common',
      order: a.order ?? 0,
      unlocked: completed,
      completed,
      unlockedAt: uaDoc?.unlockedAt ?? null,
      progress,
    }
  })
}
