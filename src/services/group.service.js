import { Group, GroupMember, User } from '../models/index.js'
import { GroupDTO, GroupMemberDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'
import { generateUniqueSlug } from '../utils/slug.js'

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
export const createGroup = async (userId, data) => {
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
        const docs = newMemberIds.map(id => ({
          groupId: group._id,
          userId: id,
          role: 'member',
          status: 'active',
          joinedAt: new Date(),
        }))
        await GroupMember.insertMany(docs)
        await Group.findByIdAndUpdate(group._id, { $inc: { memberCount: newMemberIds.length } })
      }
    }
  }

  return new GroupDTO(group)
}

/**
 * Add members to existing group (used by community invite flow).
 * Does not add duplicates or existing members.
 */
export const addMembersToGroup = async (groupId, userIds = []) => {
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
    status: 'active',
    joinedAt: now,
  }))

  await GroupMember.insertMany(docs)
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: newMemberIds.length } })

  return { added: newMemberIds.length }
}

/**
 * Join a group
 */
export const joinGroup = async (userId, groupId) => {
  const group = await Group.findById(groupId)
  if (!group || group.status !== 'active') throw new Error('GROUP_NOT_FOUND')

  const existing = await GroupMember.findOne({ groupId, userId })
  if (existing) throw new Error('ALREADY_MEMBER')

  const member = await GroupMember.create({
    groupId,
    userId,
    role: 'member',
    status: 'active',
    joinedAt: new Date(),
  })

  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: 1 } })
  return new GroupMemberDTO(member)
}

/**
 * Leave a group
 */
export const leaveGroup = async (userId, groupId) => {
  const member = await GroupMember.findOne({ groupId, userId })
  if (!member) throw new Error('NOT_MEMBER')
  if (member.role === 'owner') throw new Error('OWNER_CANNOT_LEAVE')

  await GroupMember.deleteOne({ _id: member._id })
  await Group.findByIdAndUpdate(groupId, { $inc: { memberCount: -1 } })
  return true
}

/**
 * Get group members
 */
export const getGroupMembers = async (groupId, { page = 1, limit = 20 }) => {
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await GroupMember.countDocuments({ groupId, status: 'active' })
  const members = await GroupMember.find({ groupId, status: 'active' })
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
