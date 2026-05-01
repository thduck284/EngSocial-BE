import mongoose from 'mongoose'
import { Achievement, UserAchievement, User, UserLessonProgress } from '../models/index.js'

/**
 * Check and unlock achievements for a user after any triggering event.
 * 
 * @param {string} userId - The user's ID
 * @param {object} opts - Optional hints to avoid redundant DB lookups
 *   - io: Socket.IO instance (to push real-time notifications)
 * @returns {Array} List of newly unlocked milestone objects
 */
export const checkAndUnlockAchievements = async (userId, { io } = {}) => {
  if (!userId) return []

  const uid = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId

  // 1. Load all active achievements + existing user achievement records + user stats + social counts + skill counts + quest/challenge counts
  const [achievements, existingRecords, user, completedLessonsCount, socialCounts, skillCounts, questChallengeCounts] = await Promise.all([
    Achievement.find({ active: true }).lean(),
    UserAchievement.find({ userId: uid }).lean(),
    User.findById(uid).select('streak totalXp achievementStats level').lean(),
    UserLessonProgress.countDocuments({ userId: uid, status: 'completed' }),
    (async () => {
      const { Friendship, Post, Comment } = await import('../models/index.js')
      const [f, p, c] = await Promise.all([
        Friendship.countDocuments({
          $or: [{ userId: uid }, { friendId: uid }],
          status: 'accepted'
        }),
        Post.countDocuments({ authorId: uid, status: 'active' }),
        Comment.countDocuments({ authorId: uid, status: 'active' }),
      ])
      return { friends: f, posts: p, comments: c }
    })(),
    (async () => {
      const { UserLessonProgress, Lesson } = await import('../models/index.js')
      const stats = { reading: 0, listening: 0, writing: 0 }
      
      // Get all completed progress records
      const completed = await UserLessonProgress.find({ userId: uid, status: 'completed' }).select('lessonId').lean()
      const lessonIds = completed.map(c => c.lessonId)
      
      if (lessonIds.length > 0) {
        // Count by skill
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

  if (!user) return []

  // Map existing unlocked milestones: achievementId -> { progress, unlockedMilestones (Set of values) }
  const existingMap = new Map(
    existingRecords.map((r) => [r.achievementId.toString(), r])
  )

  const newlyUnlocked = []

  for (const achievement of achievements) {
    const aId = achievement._id.toString()
    const req = achievement.requirement
    if (!req?.type) continue

    // Get current progress for this achievement type
    let currentProgress = 0
    if (req.type === 'login_streak_days') currentProgress = Number(user.streak) || 0
    else if (req.type === 'lessons_completed') {
      if (achievement.skill && achievement.skill !== 'all') {
        currentProgress = skillCounts[achievement.skill] || 0
      } else {
        currentProgress = completedLessonsCount
      }
    }
    else if (req.type === 'xp_total') currentProgress = Number(user.totalXp) || 0
    else if (req.type === 'online_minutes') {
      currentProgress = Number(user.achievementStats?.onlineMinutes) || 0
    }
    else if (req.type === 'friends_count') currentProgress = socialCounts.friends
    else if (req.type === 'community_posts') currentProgress = socialCounts.posts
    else if (req.type === 'comments_count') currentProgress = socialCounts.comments
    else if (req.type === 'daily_quests_completed') currentProgress = questChallengeCounts.periodicQuests
    else if (req.type === 'challenges_completed') currentProgress = questChallengeCounts.challenges
    else if (req.type === 'vocabulary_notes_count') currentProgress = Number(user.achievementStats?.vocabularyNotesCount) || 0
    else if (req.type === 'custom_words_count') currentProgress = Number(user.achievementStats?.customWordsCount) || 0
    else continue // Unknown requirement type, skip for now

    const milestones = Array.isArray(req.milestones) ? req.milestones : []
    const existing = existingMap.get(aId)

    // Parse already-unlocked milestone values from the stored record
    const alreadyUnlockedValues = new Set(
      Array.isArray(existing?.unlockedMilestoneValues)
        ? existing.unlockedMilestoneValues.map(Number)
        : existing
          // Legacy: if record exists with no milestoneValues array, treat maxGoal as unlocked
          ? [Number(req.value || 0)]
          : []
    )

    // Check which milestones are newly reached
    const newMilestones = milestones.filter(
      (m) => currentProgress >= Number(m.value) && !alreadyUnlockedValues.has(Number(m.value))
    )

    if (newMilestones.length === 0) {
      // No milestones but check overall completion (simple achievement without milestones)
      if (milestones.length === 0 && req.value && currentProgress >= Number(req.value) && !existing) {
        // Simple achievement unlocked
        await UserAchievement.findOneAndUpdate(
          { userId: uid, achievementId: achievement._id },
          {
            $set: {
              userId: uid,
              achievementId: achievement._id,
              progress: currentProgress,
              unlockedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        )
        newlyUnlocked.push({
          achievement,
          milestone: null,
          xpReward: Number(achievement.xpReward) || 0,
          rewardType: achievement.rewardType || 'exp',
        })
      }
      continue
    }

    // Update the record with newly unlocked milestone values
    const allUnlocked = [
      ...alreadyUnlockedValues,
      ...newMilestones.map((m) => Number(m.value)),
    ]

    await UserAchievement.findOneAndUpdate(
      { userId: uid, achievementId: achievement._id },
      {
        $set: {
          userId: uid,
          achievementId: achievement._id,
          progress: currentProgress,
          unlockedAt: existing?.unlockedAt || new Date(), // keep first unlock time
          unlockedMilestoneValues: allUnlocked,
        },
      },
      { upsert: true, new: true }
    )

    for (const milestone of newMilestones) {
      newlyUnlocked.push({
        achievement,
        milestone,
        xpReward: Number(milestone.xpReward) || 0,
        rewardType: milestone.rewardType || 'exp',
      })
    }
  }

  if (newlyUnlocked.length === 0) return []

  // 2. Award XP for each newly unlocked milestone
  let totalXpToAward = 0
  for (const item of newlyUnlocked) {
    const rt = item.rewardType
    if ((rt === 'exp' || rt === 'both') && item.xpReward > 0) {
      totalXpToAward += item.xpReward
    }
  }

  if (totalXpToAward > 0) {
    const userDoc = await User.findById(uid)
    if (userDoc) {
      userDoc.awardXp(totalXpToAward)
      await userDoc.save()
    }
  }

  // 3. Emit real-time socket events for each new unlock
  if (io) {
    for (const item of newlyUnlocked) {
      const { emitToUser } = await import('../config/socket.js')
      const badgeName = item.milestone?.badgeName || item.achievement.badgeName || ''
      const badgeIcon = item.milestone?.badgeIcon || item.achievement.badgeIcon || 'emoji_events'
      emitToUser(io, userId, 'achievement:unlocked', {
        achievementId: item.achievement._id.toString(),
        achievementKey: item.achievement.key,
        achievementName: item.achievement.name,
        milestoneName: item.milestone
          ? (item.milestone.vi || item.milestone.en || badgeName)
          : item.achievement.name,
        badgeName,
        badgeIcon,
        badgeImage: item.milestone?.badgeImage || item.achievement.badgeImage || null,
        xpReward: item.xpReward,
        rewardType: item.rewardType,
      })
    }
  }

  return newlyUnlocked
}
