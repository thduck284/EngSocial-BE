import mongoose from 'mongoose'
import { verifyToken } from '../utils/jwt.js'
import { Conversation, User } from '../models/index.js'
import { registerWordScrambleLobbyHandlers, rooms as wordScrambleRooms } from '../sockets/wordScrambleLobby.js'
import { registerWordScrambleGameHandlers } from '../sockets/wordScrambleGame.js'
import { registerSnakeGameGameHandlers } from '../sockets/snakeGameGame.js'

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : '*'

export const socketOptions = {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
}

/** Map: userId (string) -> Set of socket ids */
const userSockets = new Map()

export function registerUserSocket(userId, socketId) {
  const id = userId?.toString?.() || userId
  if (!id) return
  if (!userSockets.has(id)) userSockets.set(id, new Set())
  userSockets.get(id).add(socketId)
}

export function unregisterSocket(socketId) {
  for (const [userId, set] of userSockets) {
    set.delete(socketId)
    if (set.size === 0) userSockets.delete(userId)
  }
}

export function isUserOnline(userId) {
  const id = userId?.toString?.() || userId
  if (!id) return false
  const set = userSockets.get(id)
  return !!(set && set.size > 0)
}

/**
 * Gửi event tới mọi socket của user (room `user:${userId}`).
 * Mỗi socket đã join room này trong registerWordScrambleLobbyHandlers.
 * Dùng room thay vì io.to(socketId) — to(socketId) dễ không match tùy bản Socket.IO / adapter.
 */
export function emitToUser(io, userId, event, data) {
  if (!io) return
  const id = userId != null ? String(userId).trim() : ''
  if (!id) return
  io.to(`user:${id}`).emit(event, data)
}

export function setupSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('auth_missing'))
    try {
      const decoded = verifyToken(token)
      const userId = decoded.userId?.toString?.() || decoded.userId
      const u = await User.findById(userId).select('status').lean()
      if (!u) return next(new Error('auth_invalid'))
      if (u.status === 'banned') return next(new Error('account_banned'))
      if (u.status === 'inactive') return next(new Error('account_inactive'))
      socket.userId = userId
      next()
    } catch {
      next(new Error('auth_invalid'))
    }
  })

  /** Lấy danh sách otherUserId (bạn chat trực tiếp) để báo online/offline */
  async function getConversationPartnerIds(userId) {
    if (!userId) return []
    const id = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
    if (!id) return []
    const list = await Conversation.find({
      type: 'direct',
      participants: id,
    })
      .select('participants')
      .lean()
    const partnerIds = []
    const myStr = id.toString()
    for (const c of list) {
      const other = (c.participants || []).find((p) => p.toString() !== myStr)
      if (other) partnerIds.push(other.toString())
    }
    return partnerIds
  }

  /** Map: socketId -> connection timestamp (ms) */
  const socketConnectedAt = new Map()

  io.on('connection', (socket) => {
    registerWordScrambleLobbyHandlers(io, socket)
    registerWordScrambleGameHandlers(io, socket, wordScrambleRooms)
    registerSnakeGameGameHandlers(io, socket)
    if (socket.userId) {
      registerUserSocket(socket.userId, socket.id)
      socketConnectedAt.set(socket.id, Date.now())

      getConversationPartnerIds(socket.userId).then((partnerIds) => {
        partnerIds.forEach((partnerId) => {
          emitToUser(io, partnerId, 'conversation:userOnline', { userId: socket.userId })
        })
      }).catch(() => {})
    }

    socket.on('disconnect', () => {
      const userId = socket.userId
      const connectedAt = socketConnectedAt.get(socket.id)
      socketConnectedAt.delete(socket.id)

      // Bump online minutes on disconnect for the partial time
      if (userId && connectedAt) {
        const minutes = Math.floor((Date.now() - connectedAt) / 60000)
        if (minutes > 0) {
          User.updateOne(
            { _id: userId },
            { $inc: { 'achievementStats.onlineMinutes': minutes } }
          ).then(() => {
            import('../services/achievementUnlock.service.js').then(({ checkAndUnlockAchievements }) => {
              checkAndUnlockAchievements(userId, { io })
            })
          }).catch(() => {})
        }
      }

      unregisterSocket(socket.id)
      if (userId) {
        getConversationPartnerIds(userId).then((partnerIds) => {
          partnerIds.forEach((partnerId) => {
            emitToUser(io, partnerId, 'conversation:userOffline', { userId })
          })
        }).catch(() => {})
      }
    })
  })

  // Periodically bump online minutes for all active sockets (every 1 minute)
  setInterval(async () => {
    const userToMinutes = new Map()
    const now = Date.now()

    for (const [socketId, connectedAt] of socketConnectedAt.entries()) {
      const socket = io.sockets.sockets.get(socketId)
      const userId = socket?.userId
      if (userId) {
        const elapsed = now - connectedAt
        if (elapsed >= 60000) {
          userToMinutes.set(userId, (userToMinutes.get(userId) || 0) + 1)
          // Reset connection time to "now" so we only count the next minute later
          socketConnectedAt.set(socketId, now)
        }
      }
    }

    if (userToMinutes.size > 0) {
      const { checkAndUnlockAchievements } = await import('../services/achievementUnlock.service.js')
      for (const [userId, minutes] of userToMinutes.entries()) {
        try {
          await User.updateOne(
            { _id: userId },
            { $inc: { 'achievementStats.onlineMinutes': minutes } }
          )
          // Check achievements after bumping minutes
          await checkAndUnlockAchievements(userId, { io })
        } catch (e) {
          console.warn('[socket] online minutes bump error:', e?.message)
        }
      }
    }
  }, 60000)
}

export default socketOptions
