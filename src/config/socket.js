import mongoose from 'mongoose'
import { verifyToken } from '../utils/jwt.js'
import { Conversation } from '../models/index.js'

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['https://eng-social-fe.vercel.app', 'http://localhost:3000']

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

export function emitToUser(io, userId, event, data) {
  if (!io) return
  const id = userId?.toString?.() || userId
  const socketIds = userSockets.get(id)
  if (socketIds) {
    socketIds.forEach((sid) => io.to(sid).emit(event, data))
  }
}

export function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) return next(new Error('auth_missing'))
    try {
      const decoded = verifyToken(token)
      socket.userId = decoded.userId?.toString?.() || decoded.userId
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

  io.on('connection', (socket) => {
    if (socket.userId) {
      registerUserSocket(socket.userId, socket.id)
      getConversationPartnerIds(socket.userId).then((partnerIds) => {
        partnerIds.forEach((partnerId) => {
          emitToUser(io, partnerId, 'conversation:userOnline', { userId: socket.userId })
        })
      }).catch(() => {})
    }
    socket.on('disconnect', () => {
      const userId = socket.userId
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
}

export default socketOptions
