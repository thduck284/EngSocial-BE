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
  const group = await Group.create({
    ...data,
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

  return new GroupDTO(group)
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
