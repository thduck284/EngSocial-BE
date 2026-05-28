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

function derivedProgressForRequirement(req, user, completedLessons, skillCounts, achievementSkill, questChallengeCounts) {
  if (!req?.type || !user) return null
  const type = String(req.type)
  if (type === 'login_streak_days') return Number(user.streak) || 0
  if (type === 'lessons_completed') {
    if (achievementSkill && achievementSkill !== 'all') {
      return skillCounts?.[achievementSkill] || 0
    }
    return Math.max(0, Number(completedLessons) || 0)
  }
  if (type === 'xp_total') return Number(user.totalXp) || 0
  if (type === 'online_minutes') {
    return Math.max(0, Number(user.achievementStats?.onlineMinutes) || 0)
  }
  if (type === 'daily_quests_completed') return questChallengeCounts?.periodicQuests || 0
  if (type === 'challenges_completed') return questChallengeCounts?.challenges || 0
  if (type === 'vocabulary_notes_count') return Math.max(0, Number(user.achievementStats?.vocabularyNotesCount) || 0)
  if (type === 'custom_words_count') return Math.max(0, Number(user.achievementStats?.customWordsCount) || 0)
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
  const [achievements, userAchievements, user, completedLessons, skillCounts, questChallengeCounts] = await Promise.all([
    Achievement.find({ active: true }).sort({ order: 1, key: 1 }).lean(),
    UserAchievement.find({ userId: uid }).lean(),
    User.findById(uid).select('streak totalXp achievementStats').lean(),
    UserLessonProgress.countDocuments({ userId: uid, status: 'completed' }),
    (async () => {
      const stats = { reading: 0, listening: 0, writing: 0 }
      const completed = await UserLessonProgress.find({ userId: uid, status: 'completed' }).select('lessonId').lean()
      const lessonIds = completed.map(c => c.lessonId)
      if (lessonIds.length > 0) {
        const { Lesson } = await import('../models/index.js')
        const lessons = await Lesson.find({ _id: { $in: lessonIds } }).select('skill').lean()
        lessons.forEach(l => {
          if (stats[l.skill] !== undefined) stats[l.skill]++
        })
      }
      return stats
    })(),
    (async () => {
      const { UserPeriodicQuest, ChallengeParticipant } = await import('../models/index.js')
      const [q, c] = await Promise.all([
        UserPeriodicQuest.countDocuments({ userId: uid, completed: true }),
        ChallengeParticipant.countDocuments({ userId: uid, completed: true }),
      ])
      return { periodicQuests: q, challenges: c }
    })(),
  ])
  const byAchievementId = new Map()
  userAchievements.forEach((ua) => {
    byAchievementId.set(ua.achievementId.toString(), ua)
  })
  return achievements.map((a) => {
    const id = a._id.toString()
    const uaDoc = byAchievementId.get(id)
    const uaProgress = Number(uaDoc?.progress) || 0
    const derived = derivedProgressForRequirement(a.requirement, user, completedLessons, skillCounts, a.skill, questChallengeCounts)
    const progress =
      derived != null ? Math.max(uaProgress, derived) : uaProgress
    const maxGoal = maxGoalFromRequirement(a.requirement)
    const completed = maxGoal > 0 ? progress >= maxGoal : !!uaDoc

    // Determine current milestone reached (if any)
    let currentMilestone = null
    const earnedBadges = []

    if (Array.isArray(a.requirement?.milestones)) {
      const reached = a.requirement.milestones
        .filter((m) => progress >= m.value)
        .sort((a, b) => b.value - a.value) // highest first
      
      if (reached.length > 0) {
        currentMilestone = reached[0]
        
        // Collect ALL badges from reached milestones
        reached.forEach(m => {
          if ((m.rewardType === 'badge' || m.rewardType === 'both') && (m.badgeName || m.badgeIcon || m.badgeImage)) {
            earnedBadges.push({
              id: m._id || `${id}-${m.value}`,
              badgeName: m.badgeName || a.badgeName,
              badgeNameEn: m.badgeNameEn || a.badgeNameEn,
              badgeImage: m.badgeImage || a.badgeImage,
              badgeIcon: m.badgeIcon || a.badgeIcon,
              value: m.value
            })
          }
        })
      }
    }

    const highestBadgeMilestone = earnedBadges.length > 0 ? earnedBadges[0] : null
    const badgeSource = highestBadgeMilestone || currentMilestone

    return {
      id,
      key: a.key,
      name: currentMilestone?.vi || a.name,
      nameEn: currentMilestone?.en || a.nameEn,
      description: a.description,
      descriptionEn: a.descriptionEn,
      icon: a.icon,
      color: a.color,
      type: a.type,
      skill: a.skill,
      requirement: a.requirement,
      xpReward: currentMilestone?.xpReward ?? a.xpReward ?? 0,
      rewardType: earnedBadges.length > 0 ? 'both' : (currentMilestone?.rewardType || a.rewardType || 'both'),
      badgeName: badgeSource?.badgeName || a.badgeName,
      badgeNameEn: badgeSource?.badgeNameEn || a.badgeNameEn,
      badgeImage: badgeSource?.badgeImage || a.badgeImage,
      badgeIcon: badgeSource?.badgeIcon || a.badgeIcon,
      earnedBadges, // NEW: All badges for this achievement
      rarity: a.rarity ?? 'common',
      order: a.order ?? 0,
      unlocked: !!currentMilestone || completed,
      completed,
      unlockedAt: uaDoc?.unlockedAt ?? null,
      progress,
    }
  })
}

/**
 * Get all achievements (for admin/management)
 */
export const getAllAchievements = async () => {
  return Achievement.find({}).sort({ order: 1, key: 1 }).lean()
}

/**
 * Create a new achievement
 */
export const createAchievement = async (data) => {
  return Achievement.create(data)
}

/**
 * Update an existing achievement
 */
export const updateAchievement = async (id, data) => {
  return Achievement.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean()
}

/**
 * Delete an achievement
 */
export const deleteAchievement = async (id) => {
  return Achievement.findByIdAndDelete(id)
}
