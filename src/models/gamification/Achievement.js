import mongoose from 'mongoose'

const achievementSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  nameVi: String,
  description: String,
  descriptionVi: String,
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
  },
  xpReward: { type: Number, default: 0 },
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
