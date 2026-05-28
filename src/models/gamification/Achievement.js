import mongoose from 'mongoose'

const achievementSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  /** English title (optional; FE falls back to `name`). */
  nameEn: String,
  description: String,
  /** English “how to” (optional; FE falls back to `description`). */
  descriptionEn: String,
  icon: String,
  color: String,
  type: {
    type: String,
    enum: ['streak', 'skill', 'social', 'challenge', 'special'],
    required: true,
  },
  skill: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'all'],
  },
  requirement: {
    type: { type: String },
    value: Number,
    /** Optional multi-step copy (e.g. login streak 7 & 30). */
    milestones: [
      {
        value: { type: Number, required: true },
        vi: { type: String, default: '' },
        en: { type: String, default: '' },
        xpReward: { type: Number, default: 0 },
        rewardType: {
          type: String,
          enum: ['both', 'exp', 'badge'],
          default: 'exp',
        },
        badgeName: String,
        badgeNameEn: String,
        badgeImage: String,
        badgeIcon: String,
      },
    ],
  },
  xpReward: { type: Number, default: 0 },
  rewardType: {
    type: String,
    enum: ['both', 'exp', 'badge'],
    default: 'both',
  },
  badgeName: String,
  badgeNameEn: String,
  badgeImage: String,
  /** Material Symbols icon id for badge (no image). */
  badgeIcon: String,
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    default: 'common',
  },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
})

achievementSchema.index({ type: 1, active: 1 })

export default mongoose.model('Achievement', achievementSchema)
