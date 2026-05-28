import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import Achievement from '../src/models/gamification/Achievement.js'

/**
 * Seed achievements (category FE "learning").
 * Upsert theo `key`. Có bản song ngữ: name + nameEn, description + descriptionEn, badgeName + badgeNameEn.
 */
const learningAchievements = [
  {
    key: 'login_streak',
    name: 'Đăng nhập 7 ngày liên tiếp · Đăng nhập 30 ngày liên tiếp',
    nameEn: '7 consecutive login days · 30 consecutive login days',
    description:
      'Đăng nhập ít nhất một lần mỗi ngày để duy trì chuỗi; hoàn thành từng mốc ngày liên tiếp.',
    descriptionEn:
      'Log in at least once per day to keep your streak; complete each consecutive-day milestone.',
    icon: 'local_fire_department',
    color: '#F59E0B',
    type: 'streak',
    skill: 'all',
    requirement: {
      type: 'login_streak_days',
      value: 30,
      milestones: [
        {
          value: 7,
          vi: 'Đăng nhập 7 ngày liên tiếp',
          en: '7 consecutive login days',
          xpReward: 80,
          rewardType: 'both',
          badgeName: 'Chuỗi 7 ngày',
          badgeNameEn: '7-day streak',
          badgeIcon: 'local_fire_department',
        },
        {
          value: 30,
          vi: 'Đăng nhập 30 ngày liên tiếp',
          en: '30 consecutive login days',
          xpReward: 220,
          rewardType: 'both',
          badgeName: 'Chuỗi 30 ngày',
          badgeNameEn: '30-day streak',
          badgeIcon: 'whatshot',
        },
      ],
    },
    xpReward: 0,
    rewardType: 'exp',
    badgeName: '',
    badgeNameEn: '',
    badgeIcon: '',
    rarity: 'rare',
    order: 10,
    active: true,
  },
  {
    key: 'online_time_minutes_60',
    name: 'Tích lũy 30 phút online · Tích lũy 60 phút online',
    nameEn: '30 minutes online · 60 minutes online',
    description:
      'Tích lũy thời gian online trên nền tảng (theo tick hệ thống); hoàn thành từng mốc phút.',
    descriptionEn:
      'Accumulate online time on the platform (system ticks); complete each minute milestone.',
    icon: 'schedule',
    color: '#10B981',
    type: 'special',
    skill: 'all',
    requirement: {
      type: 'online_minutes',
      value: 60,
      milestones: [
        {
          value: 30,
          vi: 'Tích lũy 30 phút online',
          en: 'Accumulate 30 minutes online',
          xpReward: 25,
          rewardType: 'exp',
        },
        {
          value: 60,
          vi: 'Tích lũy 60 phút online',
          en: 'Accumulate 60 minutes online',
          xpReward: 35,
          rewardType: 'exp',
        },
      ],
    },
    xpReward: 0,
    rewardType: 'exp',
    rarity: 'common',
    order: 20,
    active: true,
  },
  {
    key: 'lessons_completed_any_skill_10',
    name:
      'Hoàn thành 5 bài học (mọi kỹ năng) · Hoàn thành 10 bài học (mọi kỹ năng)',
    nameEn:
      'Complete 5 lessons (all skills) · Complete 10 lessons (all skills)',
    description:
      'Hoàn thành bài học (Reading / Listening / Writing, tính tổng); hoàn thành từng mốc số bài.',
    descriptionEn:
      'Complete lessons across Reading, Listening, and Writing (aggregate); complete each lesson-count milestone.',
    icon: 'school',
    color: '#3B82F6',
    type: 'special',
    skill: 'all',
    requirement: {
      type: 'lessons_completed',
      value: 10,
      milestones: [
        {
          value: 5,
          vi: 'Hoàn thành 5 bài học (mọi kỹ năng)',
          en: 'Complete 5 lessons (all skills)',
          xpReward: 40,
          rewardType: 'both',
          badgeName: 'Học viên 5 bài',
          badgeNameEn: '5-lesson learner',
          badgeIcon: 'school',
        },
        {
          value: 10,
          vi: 'Hoàn thành 10 bài học (mọi kỹ năng)',
          en: 'Complete 10 lessons (all skills)',
          xpReward: 60,
          rewardType: 'both',
          badgeName: 'Học viên chăm chỉ',
          badgeNameEn: 'Dedicated learner',
          badgeIcon: 'workspace_premium',
        },
      ],
    },
    xpReward: 0,
    rewardType: 'exp',
    badgeName: '',
    badgeNameEn: '',
    badgeIcon: '',
    rarity: 'common',
    order: 30,
    active: true,
  },
  {
    key: 'xp_total_1000',
    name: 'Đạt tổng 500 XP · Đạt tổng 1000 XP',
    nameEn: 'Reach 500 total XP · Reach 1,000 total XP',
    description: 'Đạt tổng XP trên hồ sơ; hoàn thành từng mốc XP.',
    descriptionEn: 'Reach total XP on your profile; complete each XP milestone.',
    icon: 'bolt',
    color: '#EAB308',
    type: 'special',
    skill: 'all',
    requirement: {
      type: 'xp_total',
      value: 1000,
      milestones: [
        {
          value: 500,
          vi: 'Đạt tổng 500 XP',
          en: 'Reach 500 total XP',
          xpReward: 40,
          rewardType: 'exp',
        },
        {
          value: 1000,
          vi: 'Đạt tổng 1000 XP',
          en: 'Reach 1,000 total XP',
          xpReward: 60,
          rewardType: 'exp',
        },
      ],
    },
    xpReward: 0,
    rewardType: 'exp',
    rarity: 'common',
    order: 40,
    active: true,
  },
]

async function run() {
  await connectDB()
  const legacyStreakKeys = ['login_streak_7', 'login_streak_30']
  const removed = await Achievement.deleteMany({ key: { $in: legacyStreakKeys } })
  if (removed.deletedCount > 0) {
    console.log(
      `[seed-achievements-learning] removed ${removed.deletedCount} legacy row(s): ${legacyStreakKeys.join(', ')}`
    )
  }
  const now = new Date()
  let n = 0
  for (const doc of learningAchievements) {
    await Achievement.updateOne({ key: doc.key }, { $set: doc }, { upsert: true })
    n += 1
  }
  console.log(`[seed-achievements-learning] upserted ${n} achievement(s) at ${now.toISOString()}`)
  await mongoose.connection.close()
}

run().catch(async (err) => {
  console.error('[seed-achievements-learning] failed:', err)
  try {
    await mongoose.connection.close()
  } catch {}
  process.exit(1)
})
