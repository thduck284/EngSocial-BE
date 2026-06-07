import { User, Friendship, UserSkillStats } from '../models/index.js'
import * as achievementService from './achievement.service.js'
import { getBlockSets, isHiddenUser, assertCanViewUserContent } from '../utils/blockFilter.js'

const SKILL_LEVEL_NUM = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

const DEFAULT_PROFILE_PRIVACY = {
  showEmail: true,
  showPhone: true,
  showAddress: true,
  showDateOfBirth: true,
  showGender: true,
}

function normalizeProfilePrivacy(raw) {
  const p = raw || {}
  return {
    showEmail: p.showEmail !== false,
    showPhone: p.showPhone !== false,
    showAddress: p.showAddress !== false,
    showDateOfBirth: p.showDateOfBirth !== false,
    showGender: p.showGender !== false,
  }
}

function maskProfileFieldsForViewer(user, privacy) {
  const p = normalizeProfilePrivacy(privacy)
  return {
    email: p.showEmail ? user.email : undefined,
    phone: p.showPhone ? user.phone : undefined,
    address: p.showAddress ? user.address : undefined,
    dateOfBirth: p.showDateOfBirth ? user.dateOfBirth : undefined,
    gender: p.showGender ? user.gender : undefined,
  }
}

/**
 * Get public profile of a user for viewing by another user.
 * Returns profile + friendStatus, friendsCount, mutualFriendsCount, friends preview.
 */
export const getPublicProfile = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) {
    return null // caller should use getProfile (current user) instead
  }

  const user = await User.findById(targetUserId)
    .select('name email avatar bio phone address dateOfBirth gender level xp totalXp createdAt profileSkills profilePrivacy')
    .lean()

  if (!user) return null

  const targetId = user._id.toString()

  try {
    await assertCanViewUserContent(currentUserId, targetId, 'USER_NOT_FOUND')
  } catch {
    return null
  }
  const { hiddenIds } = await getBlockSets(currentUserId)
  const blockedByMe = false

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
  const mutualFriends = []
  currentFriendIds.forEach((id) => {
    if (targetFriendIds.has(id)) {
      mutualFriends.push(id)
    }
  })
  let mutualFriendsCount = mutualFriends.length

  // Fetch mutual friend details (first 10), exclude blocked users
  const mutualFriendsList = []
  if (mutualFriends.length > 0) {
    const visibleMutualIds = mutualFriends.filter((id) => !isHiddenUser(id, hiddenIds)).slice(0, 20)
    const details = await User.find({ _id: { $in: visibleMutualIds } })
      .select('name avatar level')
      .lean()
    details.forEach(u => {
      mutualFriendsList.push({
        id: u._id.toString(),
        name: u.name,
        avatar: u.avatar,
        level: u.level ?? 1
      })
    })
  }
  mutualFriendsCount = mutualFriends.filter((id) => !isHiddenUser(id, hiddenIds)).length

  // First 6 friends of target (for preview)
  const friendDocs = await Friendship.find({
    $or: [{ userId: targetId }, { friendId: targetId }],
    status: 'accepted',
  })
    .populate('userId', 'name avatar')
    .populate('friendId', 'name avatar')
    .limit(6)
    .lean()

  const friends = friendDocs
    .map((f) => {
      const u = f.userId._id.toString() === targetId ? f.friendId : f.userId
      return {
        id: u._id.toString(),
        name: u.name,
        avatar: u.avatar,
      }
    })
    .filter((f) => !isHiddenUser(f.id, hiddenIds))

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

  // Fetch target user's achievements and badges
  const achievementsAll = await achievementService.getAchievementsForUser(targetId)
  const earnedAchievements = (achievementsAll || []).filter(a => 
    a.unlocked && (
      (Array.isArray(a.earnedBadges) && a.earnedBadges.length > 0) ||
      (a.badgeName && String(a.badgeName).trim()) ||
      (a.badgeImage && String(a.badgeImage).trim()) ||
      (a.badgeIcon && String(a.badgeIcon).trim()) ||
      a.rewardType === 'badge' || 
      a.rewardType === 'both'
    )
  )

  const masked = maskProfileFieldsForViewer(user, user.profilePrivacy)

  return {
    id: targetId,
    name: user.name,
    email: masked.email,
    avatar: user.avatar,
    bio: user.bio,
    phone: masked.phone,
    address: masked.address,
    dateOfBirth: masked.dateOfBirth,
    gender: masked.gender,
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
    mutualFriends: mutualFriendsList,
    skills,
    achievements: earnedAchievements,
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
 * Chặn user: thêm vào blockedUserIds và xóa quan hệ bạn bè (accepted/pending).
 */
export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) throw new Error('CANNOT_BLOCK_SELF')
  const currentObj = await User.findById(currentUserId).select('blockedUserIds').lean()
  if (!currentObj) throw new Error('USER_NOT_FOUND')
  const targetObj = await User.findById(targetUserId).select('_id').lean()
  if (!targetObj) throw new Error('TARGET_USER_NOT_FOUND')
  const blocked = (currentObj.blockedUserIds || []).map((b) => b.toString())
  if (!blocked.includes(targetUserId)) {
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUserIds: targetObj._id },
    })
  }
  await Friendship.deleteMany({
    $or: [
      { userId: currentUserId, friendId: targetUserId },
      { userId: targetUserId, friendId: currentUserId },
    ],
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

export const getBlockedUsers = async (userId) => {
  const user = await User.findById(userId)
    .select('blockedUserIds')
    .populate('blockedUserIds', 'name avatar level')
    .lean()
  if (!user) throw new Error('USER_NOT_FOUND')
  return (user.blockedUserIds || []).map(u => ({
    id: u._id.toString(),
    name: u.name,
    avatar: u.avatar,
    level: u.level || 1,
  }))
}
