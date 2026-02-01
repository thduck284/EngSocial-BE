import { BaseDTO } from '../../base.dto.js'

/**
 * User Response DTO - Public user information
 */
export class UserDTO extends BaseDTO {
  constructor(user) {
    super({
      id: user._id?.toString() || user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      bio: user.bio,
      level: user.level,
      xp: user.xp,
      totalXp: user.totalXp,
      streak: user.streak,
      longestStreak: user.longestStreak,
      lastActiveDate: user.lastActiveDate,
      preferences: user.preferences,
      role: user.role,
      status: user.status,
      provider: user.provider,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  }
}

/**
 * User Profile Response DTO - Minimal user info for cards/lists
 */
export class UserProfileDTO extends BaseDTO {
  constructor(user) {
    super({
      id: user._id?.toString() || user.id,
      name: user.name,
      avatar: user.avatar,
      level: user.level,
      totalXp: user.totalXp,
    })
  }
}
