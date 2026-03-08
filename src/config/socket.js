import { verifyToken } from '../utils/jwt.js'

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

  io.on('connection', (socket) => {
    if (socket.userId) {
      registerUserSocket(socket.userId, socket.id)
    }
    socket.on('disconnect', () => {
      unregisterSocket(socket.id)
    })
  })
}

export default socketOptions
