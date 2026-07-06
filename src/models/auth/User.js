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
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
  },
  address: {
    type: String,
    trim: true,
    maxlength: 300,
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: '',
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
  weeklyXp: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastWeeklyXpReset: {
    type: Date,
    default: null,
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
  /** Lần truy cập cuối (cập nhật khi gọi API); dùng cho tin nhắn tự xóa khi offline 5p */
  lastAccessedAt: Date,
  /** Số liệu tích lũy phục vụ achievements (vd. phút online từ bump chat). */
  achievementStats: {
    onlineMinutes: { type: Number, default: 0, min: 0 },
    vocabularyNotesCount: { type: Number, default: 0, min: 0 },
    customWordsCount: { type: Number, default: 0, min: 0 },
  },
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
  /** Hết hạn khóa/tạm ngưng — null = vĩnh viễn hoặc không áp dụng */
  statusUntil: {
    type: Date,
    default: null,
  },
  /** Tăng mỗi lần đăng nhập mới — chỉ một phiên active (JWT phải khớp sv) */
  sessionVersion: {
    type: Number,
    default: 0,
    min: 0,
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
  /** Quyền riêng tư thông tin cá nhân trên trang profile công khai */
  profilePrivacy: {
    showEmail: { type: Boolean, default: true },
    showPhone: { type: Boolean, default: true },
    showAddress: { type: Boolean, default: true },
    showDateOfBirth: { type: Boolean, default: true },
    showGender: { type: Boolean, default: true },
  },
  /** Danh sách user bị mình chặn (chat 1-1: không nhận tin từ họ, họ vẫn thấy mình đã chặn) */
  blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Custom profile tab: My Skills (self-assessment)
  profileSkills: {
    skills: { type: Object, default: {} },
    goals: { type: [String], default: [] },
    activeView: { type: String, enum: ['bars', 'radar'], default: 'bars' },
    updatedAt: { type: Date, default: null },
  },
}, {
  timestamps: true,
  bufferCommands: true,
})

// Indexes (email đã có unique: true trong schema)
userSchema.index({ name: 'text' })
userSchema.index({ totalXp: -1 })
userSchema.index({ level: -1, xp: -1 })
userSchema.index({ status: 1 })

// Helper to get week identifier (ISO 8601)
const getWeekIdentifier = (d) => {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 4 - (date.getDay() || 7))
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getFullYear()}-W${weekNo}`
}

// Check and update level based on XP
userSchema.methods.awardXp = function(amount = 0) {
  if (amount > 0) {
    this.totalXp += amount
    this.xp += amount
    
    // Handle weekly XP reset
    const now = new Date()
    if (!this.lastWeeklyXpReset) {
      this.weeklyXp = 0
    } else {
      const currentWeek = getWeekIdentifier(now)
      const lastResetWeek = getWeekIdentifier(this.lastWeeklyXpReset)
      if (currentWeek !== lastResetWeek) {
        this.weeklyXp = 0
      }
    }
    this.weeklyXp += amount
    this.lastWeeklyXpReset = now
  }
  
  while (this.level < 100) {
    const nextLevel = this.level + 1
    const xpNeededForNext = nextLevel * 50
    if (this.xp >= xpNeededForNext) {
      this.xp -= xpNeededForNext
      this.level = nextLevel
    } else {
      break
    }
  }
}

export default mongoose.model('User', userSchema)
