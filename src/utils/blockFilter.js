import mongoose from 'mongoose'
import { User } from '../models/index.js'

/**
 * Load bidirectional block sets for a viewer.
 * hiddenIds = users I blocked + users who blocked me.
 */
export async function getBlockSets(userId) {
  if (!userId) {
    return { myBlockedIds: new Set(), blockedMeIds: new Set(), hiddenIds: new Set() }
  }
  const uid = userId?.toString?.() || String(userId)
  const [me, blockedMeUsers] = await Promise.all([
    User.findById(uid).select('blockedUserIds').lean(),
    User.find({ blockedUserIds: uid }).select('_id').lean(),
  ])
  const myBlockedIds = new Set((me?.blockedUserIds || []).map((b) => b.toString()))
  const blockedMeIds = new Set(blockedMeUsers.map((u) => u._id.toString()))
  const hiddenIds = new Set([...myBlockedIds, ...blockedMeIds])
  return { myBlockedIds, blockedMeIds, hiddenIds }
}

export function toUserIdString(userId) {
  if (!userId) return ''
  if (typeof userId === 'string') return userId
  return userId._id?.toString?.() || userId.toString?.() || String(userId)
}

export function isHiddenUser(userId, hiddenIds) {
  if (!hiddenIds?.size || !userId) return false
  return hiddenIds.has(toUserIdString(userId))
}

export function hiddenUserObjectIds(hiddenIds) {
  if (!hiddenIds?.size) return []
  return [...hiddenIds]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id))
}

export function filterHiddenById(items, getUserId, hiddenIds) {
  if (!hiddenIds?.size || !Array.isArray(items)) return items
  return items.filter((item) => !isHiddenUser(getUserId(item), hiddenIds))
}

/**
 * Block hai chiều: viewer không được xem/tương tác nội dung của target.
 * @throws {Error} notFoundError — mặc định USER_NOT_FOUND (profile); post dùng POST_NOT_FOUND.
 */
export async function assertCanViewUserContent(viewerId, targetUserId, notFoundError = 'USER_NOT_FOUND') {
  const viewer = toUserIdString(viewerId)
  const target = toUserIdString(targetUserId)
  if (!viewer || !target || viewer === target) return
  const { hiddenIds } = await getBlockSets(viewer)
  if (isHiddenUser(target, hiddenIds)) {
    throw new Error(notFoundError)
  }
}
