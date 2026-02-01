import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // Don't return password by default
  },
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100,
    trim: true,
  },
  avatar: String,
  bio: {
    type: String,
    maxlength: 500,
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100,
  },
  xp: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalXp: {
    type: Number,
    default: 0,
    min: 0,
  },
  streak: {
    type: Number,
    default: 0,
    min: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastActiveDate: Date,
  preferences: {
    language: {
      type: String,
      enum: ['vi', 'en'],
      default: 'vi',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    dailyGoalMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 240,
    },
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'pending'],
    default: 'pending',
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local',
  },
  providerId: String,
  emailVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
})

// Indexes
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ name: 'text' })
userSchema.index({ totalXp: -1 })
userSchema.index({ level: -1, xp: -1 })
userSchema.index({ status: 1 })

export default mongoose.model('User', userSchema)
