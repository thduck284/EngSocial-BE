import { User, Friendship, UserSkillStats } from '../models/index.js'

const SKILL_LEVEL_NUM = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

/**
 * Get public profile of a user for viewing by another user.
 * Returns profile + friendStatus, friendsCount, mutualFriendsCount, friends preview.
 */
export const getPublicProfile = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    return null // caller should use getProfile (current user) instead
  }

  const user = await User.findById(targetUserId)
    .select('name email avatar bio phone address dateOfBirth gender level xp totalXp createdAt profileSkills')
    .lean()

  if (!user) return null

  const targetId = user._id.toString()

  // Check if current user has blocked this profile user
  const currentUserDoc = await User.findById(currentUserId).select('blockedUserIds').lean()
  const blockedByMe = (currentUserDoc?.blockedUserIds || []).some((b) => b.toString() === targetId)

  // Friendship between current user and target
  const friendship = await Friendship.findOne({
    $or: [
      { userId: currentUserId, friendId: targetId },
      { userId: targetId, friendId: currentUserId },
    ],
  }).lean()

  let friendStatus = 'none'
  let friendshipId = null
  let pendingSentByMe = false
  if (friendship) {
    friendStatus = friendship.status === 'accepted' ? 'connected' : 'pending'
    friendshipId = friendship._id.toString()
    if (friendship.status === 'pending') {
      pendingSentByMe = friendship.userId.toString() === currentUserId
    }
  }

  // Friends count (accepted) for target user
  const friendsCount = await Friendship.countDocuments({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  })

  // Mutual friends count (users who are friends with both current and target)
  const currentFriends = await Friendship.find({
    $or: [{ userId: currentUserId }, { friendId: currentUserId }],
    status: 'accepted',
  }).lean()
  const currentFriendIds = new Set(
    currentFriends.map((f) =>
      f.userId.toString() === currentUserId ? f.friendId.toString() : f.userId.toString()
    )
  )
  const targetFriends = await Friendship.find({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  }).lean()
  const targetFriendIds = new Set(
    targetFriends.map((f) =>
      f.userId.toString() === targetId ? f.friendId.toString() : f.userId.toString()
    )
  )
  let mutualFriendsCount = 0
  currentFriendIds.forEach((id) => {
    if (targetFriendIds.has(id)) mutualFriendsCount++
  })

  // First 6 friends of target (for preview)
  const friendDocs = await Friendship.find({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  })
    .populate('userId', 'name avatar')
    .populate('friendId', 'name avatar')
    .limit(6)
    .lean()

  const friends = friendDocs.map((f) => {
    const u = f.userId._id.toString() === targetId ? f.friendId : f.userId
    return {
      id: u._id.toString(),
      name: u.name,
      avatar: u.avatar,
    }
  })

  // Skill stats (reading, listening, writing) for "My skills" block
  const skillStatsDocs = await UserSkillStats.find({ userId: targetId }).lean()
  const skillsRaw = (skillStatsDocs || []).map((s) => {
    const totalXp = Number(s.totalXpEarned) || 0
    const level = SKILL_LEVEL_NUM[s.skillLevel] ?? 1
    const percent = Math.min(100, Math.round(totalXp / 50))
    return {
      key: s.skill,
      labelKey: `skills.${s.skill}`,
      level,
      skillLevel: s.skillLevel,
      percent,
      totalXpEarned: totalXp,
      totalTimeSpent: Number(s.totalTimeSpent) || 0, // minutes
      weeklyTimeSpent: Number(s.weeklyTimeSpent) || 0, // minutes
      dailyTimeSpent: Number(s.dailyTimeSpent) || 0, // minutes
      lessonsCompleted: Number(s.lessonsCompleted) || 0,
      lessonsInProgress: Number(s.lessonsInProgress) || 0,
      averageScore: Number(s.averageScore) || 0,
      highestScore: Number(s.highestScore) || 0,
    }
  })

  const defaultSkillKeys = ['reading', 'listening', 'writing']
  const skillsByKey = new Map((skillsRaw || []).map((s) => [s.key, s]))
  const skills = defaultSkillKeys.map((skillKey) => {
    const existing = skillsByKey.get(skillKey)
    if (existing) return existing
    return {
      key: skillKey,
      labelKey: `skills.${skillKey}`,
      level: 1,
      skillLevel: 'A1',
      percent: 0,
      totalXpEarned: 0,
      totalTimeSpent: 0,
      weeklyTimeSpent: 0,
      dailyTimeSpent: 0,
      lessonsCompleted: 0,
      lessonsInProgress: 0,
      averageScore: 0,
      highestScore: 0,
    }
  })

  return {
    id: targetId,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    phone: user.phone,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    level: user.level ?? 1,
    xp: user.xp ?? 0,
    totalXp: user.totalXp ?? 0,
    createdAt: user.createdAt,
    friendStatus,
    friendshipId,
    pendingSentByMe,
    blockedByMe,
    friendsCount,
    mutualFriendsCount,
    friends,
    skills,
    profileSkills: user.profileSkills || { skills: {}, goals: [], activeView: 'bars', updatedAt: null },
  }
}

// Helper to get week identifier (ISO 8601)
const getWeekIdentifier = (d) => {
  if (!d) return null
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 4 - (date.getDay() || 7))
  const yearStart = new Date(date.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
  return `${date.getFullYear()}-W${weekNo}`
}

export const getMyStats = async (userId) => {
  const user = await User.findById(userId).select('level xp totalXp')
  if (!user) return null

  // Auto-level up if stalled (compensation logic)
  const nextLevel = user.level + 1
  const xpNeededForNext = nextLevel * 50
  if (user.xp >= xpNeededForNext) {
    user.awardXp(0)
    await user.save()
  }

  const skillDocs = await UserSkillStats.find({ userId }).lean()
  const weeklyXp = { reading: 0, listening: 0, writing: 0 }
  const skillStats = []
  
  const now = new Date()
  const currentWeek = getWeekIdentifier(now)

  for (const doc of skillDocs || []) {
    const totalXp = Number(doc.totalXpEarned) || 0
    
    let weeklyXpEarned = Number(doc.weeklyXpEarned) || 0
    let weeklyTimeSpent = Number(doc.weeklyTimeSpent) || 0
    const lastResetWeek = getWeekIdentifier(doc.lastWeeklyXpReset)
    
    if (currentWeek !== lastResetWeek) {
      weeklyXpEarned = 0
      weeklyTimeSpent = 0
    }
    
    const percent = Math.min(100, Math.round(totalXp / 50))
    weeklyXp[doc.skill] = weeklyXpEarned
    
    skillStats.push({
      key: doc.skill,
      labelKey: `skills.${doc.skill}`,
      skillLevel: doc.skillLevel,
      level: SKILL_LEVEL_NUM[doc.skillLevel] ?? 1,
      percent,
      totalXpEarned: totalXp,
      totalTimeSpent: Number(doc.totalTimeSpent) || 0,
      weeklyTimeSpent: weeklyTimeSpent,
      dailyTimeSpent: Number(doc.dailyTimeSpent) || 0,
      lessonsCompleted: Number(doc.lessonsCompleted) || 0,
      lessonsInProgress: Number(doc.lessonsInProgress) || 0,
      averageScore: Number(doc.averageScore) || 0,
      highestScore: Number(doc.highestScore) || 0,
    })
  }

  return {
    level: Number(user.level) || 1,
    currentXp: Number(user.xp) || 0,
    xpToNextLevel: (Number(user.level) + 1) * 50,
    weeklyXp,
    skillStats,
  }
}

export const getMySkillProfile = async (userId) => {
  const user = await User.findById(userId).select('profileSkills').lean()
  if (!user) return null
  return user.profileSkills || { skills: {}, goals: [], activeView: 'bars', updatedAt: null }
}

export const updateMySkillProfile = async (userId, payload) => {
  const next = {
    skills: payload?.skills && typeof payload.skills === 'object' ? payload.skills : {},
    goals: Array.isArray(payload?.goals) ? payload.goals : [],
    activeView: payload?.activeView === 'radar' ? 'radar' : 'bars',
    updatedAt: new Date(),
  }
  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { profileSkills: next } },
    { new: true, select: 'profileSkills' },
  ).lean()
  if (!updated) return null
  return updated.profileSkills
}

/**
 * Chặn user (chat 1-1): thêm targetUserId vào blockedUserIds của current user.
 * Không thể chặn chính mình.
 */
export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) throw new Error('CANNOT_BLOCK_SELF')
  const currentObj = await User.findById(currentUserId).select('blockedUserIds').lean()
  if (!currentObj) throw new Error('USER_NOT_FOUND')
  const targetObj = await User.findById(targetUserId).select('_id').lean()
  if (!targetObj) throw new Error('TARGET_USER_NOT_FOUND')
  const blocked = (currentObj.blockedUserIds || []).map((b) => b.toString())
  if (blocked.includes(targetUserId)) return { blocked: true }
  await User.findByIdAndUpdate(currentUserId, {
    $addToSet: { blockedUserIds: targetObj._id },
  })
  return { blocked: true }
}

/**
 * Bỏ chặn user: xóa targetUserId khỏi blockedUserIds của current user.
 */
export const unblockUser = async (currentUserId, targetUserId) => {
  const currentObj = await User.findById(currentUserId).select('blockedUserIds').lean()
  if (!currentObj) throw new Error('USER_NOT_FOUND')
  await User.findByIdAndUpdate(currentUserId, {
    $pull: { blockedUserIds: targetUserId },
  })
  return { unblocked: true }
}
