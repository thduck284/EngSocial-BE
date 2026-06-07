import { Group, GroupMember, User } from '../models/index.js'
import { GroupDTO, GroupMemberDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { generateUniqueSlug } from '../utils/slug.js'
import { getBlockSets, isHiddenUser, hiddenUserObjectIds } from '../utils/blockFilter.js'
import * as notificationService from './notification.service.js'
import { emitToUser } from '../config/socket.js'

/** Chỉ người tự xin vào (pending, không có invitedBy) */
const selfJoinPendingFilter = {
  $or: [{ invitedBy: { $exists: false } }, { invitedBy: null }],
}

async function notifyUsersGroupInvited(io, { groupId, inviterUserId, invitedUserIds }) {
  if (!invitedUserIds?.length || !inviterUserId) return
  const [group, inviter] = await Promise.all([
    Group.findById(groupId).select('name').lean(),
    User.findById(inviterUserId).select('name').lean(),
  ])
  const groupName = group?.name || 'Nhóm'
  const inviterName = inviter?.name || 'Ai đó'
  const gid = groupId?.toString?.() || String(groupId)
  for (const rawId of invitedUserIds) {
    const userId = rawId?.toString?.() || String(rawId)
    const notification = await notificationService.createNotification({
      userId: rawId,
      type: 'group_invite',
      title: 'Lời mời vào nhóm',
      message: `${inviterName} mời bạn tham gia nhóm «${groupName}»`,
      fromUserId: inviterUserId,
      relatedId: groupId,
      relatedType: 'group',
      data: { groupId: gid, groupName },
    })
    emitToUser(io, userId, 'notification', notification)
  }
}

/**
 * Get groups
 */
export const getGroups = async ({ type, category, search, page = 1, limit = 10 }) => {
  const filter = { status: 'active' }
  if (type) filter.type = type
  if (category) filter.category = category
  if (search) filter.name = { $regex: search, $options: 'i' }

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Group.countDocuments(filter)
  const groups = await Group.find(filter).sort({ memberCount: -1 }).skip(skip).limit(perPage)

  return {
    groups: groups.map(g => new GroupDTO(g)),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get group by ID
 */
export const getGroupById = async (groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status === 'deleted') throw new Error('GROUP_NOT_FOUND')
  return new GroupDTO(group)
}

/**
 * Create group
 */
export const createGroup = async (userId, data, io = null) => {
  const slug = generateUniqueSlug(data.name)
  const { inviteUserIds, ...rest } = data || {}
  const group = await Group.create({
    ...rest,
    slug,
    createdBy: userId,
    admins: [userId],
    memberCount: 1,
  })

  await GroupMember.create({
    groupId: group._id,
    userId,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  })

  // Optional: add invited members immediately
  if (Array.isArray(inviteUserIds) && inviteUserIds.length > 0) {
    const uniqueIds = [...new Set(inviteUserIds.filter(Boolean).map(id => id.toString()))]
    const filteredIds = uniqueIds.filter(id => id !== userId.toString())
    if (filteredIds.length > 0) {
      const existingMembers = await GroupMember.find({
        groupId: group._id,
        userId: { $in: filteredIds },
      }).select('userId').lean()
      const existingSet = new Set(existingMembers.map(m => m.userId.toString()))
      const newMemberIds = filteredIds.filter(id => !existingSet.has(id))
      if (newMemberIds.length > 0) {
        const docs = newMemberIds.map((id) => ({
          groupId: group._id,
          userId: id,
          role: 'member',
          status: 'pending',
          joinedAt: new Date(),
          invitedBy: userId,
        }))
        await GroupMember.insertMany(docs)
        await notifyUsersGroupInvited(io, {
          groupId: group._id,
          inviterUserId: userId,
          invitedUserIds: newMemberIds,
        })
      }
    }
  }

  return new GroupDTO(group)
}

/**
 * Add members to existing group (community invite): tạo bản ghi chờ duyệt, không tăng memberCount.
 */
export const addMembersToGroup = async (groupId, userIds = [], invitedByUserId = null, io = null) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { added: 0 }
  }

  const uniqueIds = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))]
  if (uniqueIds.length === 0) {
    return { added: 0 }
  }

  const existingMembers = await GroupMember.find({
    groupId,
    userId: { $in: uniqueIds },
  })
    .select('userId')
    .lean()

  const existingSet = new Set(existingMembers.map((m) => m.userId.toString()))
  const newMemberIds = uniqueIds.filter((id) => !existingSet.has(id))

  if (newMemberIds.length === 0) {
    return { added: 0 }
  }

  const now = new Date()
  const docs = newMemberIds.map((id) => ({
    groupId,
    userId: id,
    role: 'member',
    status: 'pending',
    joinedAt: now,
    ...(invitedByUserId && { invitedBy: invitedByUserId }),
  }))

  await GroupMember.insertMany(docs)

  if (invitedByUserId) {
    await notifyUsersGroupInvited(io, {
      groupId,
      inviterUserId: invitedByUserId,
      invitedUserIds: newMemberIds,
    })
  }

  return { added: newMemberIds.length }
}

async function getActiveGroupModerator(actorUserId, groupId) {
  const m = await GroupMember.findOne({ groupId, userId: actorUserId, status: 'active' })
  if (!m || (m.role !== 'owner' && m.role !== 'admin')) return null
  return m
}

/**
 * Xin tham gia nhóm: luôn tạo pending (mọi loại nhóm), chủ/admin duyệt mới vào — không tự động active.
 */
export const joinGroup = async (userId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const existing = await GroupMember.findOne({ groupId, userId })
  if (existing) {
    if (existing.status === 'active') throw new Error('ALREADY_MEMBER')
    if (existing.status === 'pending') throw new Error('JOIN_PENDING')
    throw new Error('ALREADY_MEMBER')
  }

  const member = await GroupMember.create({
    groupId,
    userId,
    role: 'member',
    status: 'pending',
    joinedAt: new Date(),
  })

  return new GroupMemberDTO(member)
}

/**
 * Leave a group
 */
export const leaveGroup = async (userId, groupId) => {
  const member = await GroupMember.findOne({ groupId, userId })
  if (!member) throw new Error('NOT_MEMBER')
  if (member.role === 'owner') throw new Error('OWNER_CANNOT_LEAVE')

  const wasActive = member.status === 'active'
  await GroupMember.deleteOne({ _id: member._id })
  if (wasActive) {
    await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } })
  }
  return true
}

/**
 * Remove another member (owner/admin only). Cannot remove owner or self.
 */
export const removeMemberFromGroup = async (actorUserId, groupId, targetUserId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const actorIdStr = actorUserId.toString()
  const targetIdStr = targetUserId.toString()

  if (actorIdStr === targetIdStr) throw new Error('CANNOT_KICK_SELF')

  const actor = await GroupMember.findOne({ groupId, userId: actorUserId, status: 'active' })
  if (!actor) throw new Error('NOT_MEMBER')

  const target = await GroupMember.findOne({ groupId, userId: targetUserId, status: 'active' })
  if (!target) throw new Error('TARGET_NOT_MEMBER')

  const elevated = actor.role === 'owner' || actor.role === 'admin'
  if (!elevated) throw new Error('FORBIDDEN_KICK')

  if (target.role === 'owner') throw new Error('CANNOT_KICK_OWNER')

  if (actor.role === 'admin' && target.role === 'admin') throw new Error('FORBIDDEN_KICK')

  await GroupMember.deleteOne({ _id: target._id })
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } })

  if (Array.isArray(group.admins) && group.admins.some((id) => id.toString() === targetIdStr)) {
    await Group.findByIdAndUpdate(groupId, { $pull: { admins: targetUserId } })
  }

  return true
}

/**
 * Get group members. When viewerId is set, hide users blocked by/with viewer.
 */
export const getGroupMembers = async (groupId, { page = 1, limit = 20, viewerId = null } = {}) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const filter = { groupId, status: 'active' }
  if (viewerId) {
    const { hiddenIds } = await getBlockSets(viewerId)
    const excludeIds = hiddenUserObjectIds(hiddenIds)
    if (excludeIds.length) filter.userId = { $nin: excludeIds }
  }
  const total = await GroupMember.countDocuments(filter)
  const members = await GroupMember.find(filter)
    .populate('userId', 'name avatar level totalXp')
    .sort({ joinedAt: 1 })
    .skip(skip)
    .limit(perPage)

  return {
    members: members.map(m => ({
      ...new GroupMemberDTO(m),
      user: m.userId ? { id: m.userId._id, name: m.userId.name, avatar: m.userId.avatar, level: m.userId.level } : null,
    })),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Get user's groups
 */
export const getUserGroups = async (userId, { page = 1, limit = 10 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await GroupMember.countDocuments({ userId, status: 'active' })
  const memberships = await GroupMember.find({ userId, status: 'active' })
    .populate('groupId')
    .sort({ joinedAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    groups: memberships.map(m => m.groupId ? new GroupDTO(m.groupId) : null).filter(Boolean),
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Yêu cầu tham gia: chỉ người tự xin (pending, không invitedBy).
 * invitedPendingUserIds: id user đang pending do được mời — dùng FE loại trùng modal mời.
 */
export const getGroupJoinRequests = async (actorUserId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const mod = await getActiveGroupModerator(actorUserId, groupId)
  if (!mod) throw new Error('FORBIDDEN_JOIN_REQUESTS')

  const selfPending = await GroupMember.find({
    groupId,
    status: 'pending',
    ...selfJoinPendingFilter,
  })
    .populate('userId', 'name avatar level totalXp')
    .sort({ joinedAt: 1 })

  const invitedPending = await GroupMember.find({
    groupId,
    status: 'pending',
    invitedBy: { $exists: true, $ne: null },
  })
    .select('userId')
    .lean()

  const invitedPendingUserIds = invitedPending.map((row) => row.userId.toString())

  const { hiddenIds } = await getBlockSets(actorUserId)
  const joinRequests = selfPending
    .filter((m) => !isHiddenUser(m.userId?._id || m.userId, hiddenIds))
    .map((m) => ({
      ...new GroupMemberDTO(m),
      user: m.userId
        ? {
            id: m.userId._id,
            name: m.userId.name,
            avatar: m.userId.avatar,
            level: m.userId.level,
          }
        : null,
    }))

  return { joinRequests, invitedPendingUserIds }
}

export const approveGroupJoinRequest = async (actorUserId, groupId, targetUserId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const mod = await getActiveGroupModerator(actorUserId, groupId)
  if (!mod) throw new Error('FORBIDDEN_JOIN_REQUESTS')

  const target = await GroupMember.findOne({
    groupId,
    userId: targetUserId,
    status: 'pending',
    ...selfJoinPendingFilter,
  })
  if (!target) throw new Error('REQUEST_NOT_FOUND')

  target.status = 'active'
  await target.save()
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } })
  return new GroupMemberDTO(target)
}

export const rejectGroupJoinRequest = async (actorUserId, groupId, targetUserId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const mod = await getActiveGroupModerator(actorUserId, groupId)
  if (!mod) throw new Error('FORBIDDEN_JOIN_REQUESTS')

  const target = await GroupMember.findOne({
    groupId,
    userId: targetUserId,
    status: 'pending',
    ...selfJoinPendingFilter,
  })
  if (!target) throw new Error('REQUEST_NOT_FOUND')

  await GroupMember.deleteOne({ _id: target._id })
  return true
}

const GROUP_TYPES = new Set(['public', 'private', 'invite_only'])

/**
 * Chủ nhóm / admin: cập nhật thông tin nhóm
 */
export const updateGroup = async (actorUserId, groupId, data = {}) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const mod = await getActiveGroupModerator(actorUserId, groupId)
  if (!mod) throw new Error('FORBIDDEN_UPDATE_GROUP')

  const patch = {}
  if (data.name !== undefined) {
    const name = String(data.name).trim()
    if (!name || name.length > 100) throw new Error('INVALID_GROUP_NAME')
    patch.name = name
    if (name !== group.name) {
      patch.slug = generateUniqueSlug(name)
    }
  }
  if (data.description !== undefined) {
    const d = data.description == null ? '' : String(data.description).trim()
    if (d.length > 500) throw new Error('INVALID_GROUP_DESCRIPTION')
    patch.description = d || undefined
  }
  if (data.icon !== undefined) {
    const icon = data.icon == null ? '' : String(data.icon).trim()
    patch.icon = icon || undefined
  }
  if (data.type !== undefined) {
    const ty = String(data.type)
    if (!GROUP_TYPES.has(ty)) throw new Error('INVALID_GROUP_TYPE')
    patch.type = ty
  }

  if (Object.keys(patch).length === 0) {
    return new GroupDTO(group)
  }
  Object.assign(group, patch)
  await group.save()
  return new GroupDTO(group)
}

export const getMyGroupMembership = async (userId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status === 'deleted') throw new Error('GROUP_NOT_FOUND')
  const m = await GroupMember.findOne({ groupId, userId }).lean()
  if (!m) return null
  return {
    status: m.status,
    role: m.role,
    invitedBy: m.invitedBy ? m.invitedBy.toString() : null,
  }
}

/** Người được mời: chấp nhận lời mời (pending + có invitedBy) */
export const acceptMyGroupInvite = async (userId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const m = await GroupMember.findOne({
    groupId,
    userId,
    status: 'pending',
    invitedBy: { $exists: true, $ne: null },
  })
  if (!m) throw new Error('NO_INVITE')

  m.status = 'active'
  await m.save()
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } })
  return new GroupMemberDTO(m)
}

export const declineMyGroupInvite = async (userId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const m = await GroupMember.findOne({
    groupId,
    userId,
    status: 'pending',
    invitedBy: { $exists: true, $ne: null },
  })
  if (!m) throw new Error('NO_INVITE')

  await GroupMember.deleteOne({ _id: m._id })
  return true
}
