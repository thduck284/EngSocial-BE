import { Achievement, UserAchievement } from '../models/index.js'

/**
 * Get all active achievements with current user's unlock state.
 * GET /api/user/achievements (for current user).
 */
export const getAchievementsForUser = async (userId) => {
  const [achievements, userAchievements] = await Promise.all([
    Achievement.find({ active: true }).sort({ order: 1, key: 1 }).lean(),
    UserAchievement.find({ userId }).lean(),
  ])
  const byAchievementId = new Map()
  userAchievements.forEach((ua) => {
    byAchievementId.set(ua.achievementId.toString(), {
      unlocked: true,
      unlockedAt: ua.unlockedAt,
      progress: ua.progress ?? 0,
    })
  })
  return achievements.map((a) => {
    const id = a._id.toString()
    const ua = byAchievementId.get(id)
    return {
      id,
      key: a.key,
      name: a.name,
      nameVi: a.nameVi,
      description: a.description,
      descriptionVi: a.descriptionVi,
      icon: a.icon,
      color: a.color,
      type: a.type,
      skill: a.skill,
      requirement: a.requirement,
      xpReward: a.xpReward ?? 0,
      rarity: a.rarity ?? 'common',
      order: a.order ?? 0,
      unlocked: !!ua,
      unlockedAt: ua?.unlockedAt ?? null,
      progress: ua?.progress ?? 0,
    }
  })
}
