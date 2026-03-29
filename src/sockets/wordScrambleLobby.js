import mongoose from 'mongoose'
import { User } from '../models/index.js'
import * as matchmakingService from '../services/matchmaking.service.js'

/** @typedef {{ userId: string, name: string, avatar: string, ready: boolean, socketId?: string }} LobbyMember */

/** @type {Map<string, { code: string, capacity: number, hostId: string, slots: (LobbyMember | null)[], chat: { userId: string, name: string, text: string, ts: number }[] }>} */
const rooms = new Map()

/** @type {Map<number, LobbyMember[]>} */
const globalQueues = new Map([
  [2, []], [4, []], [6, []], [8, []]
])

const ALLOWED_CAPACITIES = [2, 4, 6, 8]

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function newRoomCode() {
  let code = genCode()
  let guard = 0
  while (rooms.has(code) && guard < 20) {
    code = genCode()
    guard += 1
  }
  return code
}

async function loadProfile(userId) {
  const id = userId?.toString?.() || userId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { userId: String(id), name: 'Player', avatar: '' }
  }
  const u = await User.findById(id).select('name avatar').lean()
  return {
    userId: String(id),
    name: (u?.name || 'Player').trim(),
    avatar: u?.avatar || '',
  }
}

function roomChannel(code) {
  return `wsLobby:${code}`
}

function serializeRoom(room) {
  return {
    roomCode: room.code,
    capacity: room.capacity,
    hostId: room.hostId,
    slots: room.slots.map((s) =>
      s ? { userId: s.userId, name: s.name, avatar: s.avatar, ready: !!s.ready } : null
    ),
    chat: room.chat.slice(-40),
  }
}

function broadcastRoom(io, code) {
  const room = rooms.get(code)
  if (!room) return
  io.to(roomChannel(code)).emit('wordScrambleLobby:state', serializeRoom(room))
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerWordScrambleLobbyHandlers(io, socket) {
  /** @type {string | null} */
  let currentRoomCode = null

  const leaveRoom = () => {
    // Rời khỏi Lobby Room (nếu có)
    if (currentRoomCode) {
      const code = currentRoomCode
      currentRoomCode = null
      socket.leave(roomChannel(code))
      const room = rooms.get(code)
      if (room) {
        const uid = String(socket.userId)
        const idx = room.slots.findIndex((s) => s && s.userId === uid)
        if (idx >= 0) room.slots[idx] = null
        if (String(room.hostId) === uid) {
          const next = room.slots.find((s) => s != null)
          room.hostId = next ? next.userId : ''
        }
        if (!room.slots.some(Boolean) || !room.hostId) {
          rooms.delete(code)
        } else {
          broadcastRoom(io, code)
        }
      }
    }

    // Rời khỏi Hàng chờ toàn cầu (nếu có)
    for (const [cap, queue] of globalQueues.entries()) {
      const idx = queue.findIndex(m => m.socketId === socket.id)
      if (idx >= 0) {
        queue.splice(idx, 1)
        console.log(`User ${socket.userId} left global queue ${cap}`)
      }
    }
  }

  socket.on('disconnect', () => {
    leaveRoom()
  })

  socket.on('wordScrambleLobby:leave', () => {
    leaveRoom()
  })

  socket.on('wordScrambleLobby:sync', (_payload, ack) => {
    if (!currentRoomCode) return ack?.({ ok: false, error: 'no_room' })
    const room = rooms.get(currentRoomCode)
    if (!room) return ack?.({ ok: false, error: 'gone' })
    ack?.({ ok: true, state: serializeRoom(room) })
  })

  socket.on('wordScrambleLobby:create', async (payload, ack) => {
    try {
      const capacity = Number(payload?.capacity)
      if (!ALLOWED_CAPACITIES.includes(capacity)) {
        return ack?.({ ok: false, error: 'invalid_capacity' })
      }
      leaveRoom()
      const profile = await loadProfile(socket.userId)
      const code = newRoomCode()
      const slots = Array.from({ length: capacity }, () => null)
      slots[0] = { ...profile, ready: false, socketId: socket.id }
      rooms.set(code, {
        code,
        capacity,
        hostId: String(socket.userId),
        slots,
        chat: [],
      })
      currentRoomCode = code
      await socket.join(roomChannel(code))
      const room = rooms.get(code)
      broadcastRoom(io, code)
      ack?.({ ok: true, state: serializeRoom(room) })
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'create_failed' })
    }
  })

  socket.on('wordScrambleLobby:join', async (payload, ack) => {
    try {
      const roomCode = String(payload?.roomCode || '')
        .trim()
        .toUpperCase()
      const room = rooms.get(roomCode)
      if (!room) return ack?.({ ok: false, error: 'not_found' })
      const uid = String(socket.userId)
      for (let i = 0; i < room.slots.length; i++) {
        const s = room.slots[i]
        if (s && s.userId === uid) room.slots[i] = null
      }
      const emptyIdx = room.slots.findIndex((s) => s == null)
      if (emptyIdx < 0) return ack?.({ ok: false, error: 'full' })
      leaveRoom()
      const profile = await loadProfile(uid)
      room.slots[emptyIdx] = { ...profile, ready: false, socketId: socket.id }
      if (!room.hostId) room.hostId = uid
      currentRoomCode = roomCode
      await socket.join(roomChannel(roomCode))
      broadcastRoom(io, roomCode)
      ack?.({ ok: true, state: serializeRoom(room) })
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'join_failed' })
    }
  })

  socket.on('wordScrambleLobby:setReady', (payload, ack) => {
    const code = currentRoomCode
    if (!code) return ack?.({ ok: false, error: 'no_room' })
    const room = rooms.get(code)
    if (!room) return ack?.({ ok: false, error: 'gone' })
    const uid = String(socket.userId)
    const slot = room.slots.find((s) => s && s.userId === uid)
    if (!slot) return ack?.({ ok: false, error: 'not_in_room' })
    slot.ready = !!payload?.ready
    broadcastRoom(io, code)
    ack?.({ ok: true })
  })

  socket.on('wordScrambleLobby:chat', (payload, ack) => {
    const code = currentRoomCode
    if (!code) return ack?.({ ok: false, error: 'no_room' })
    const room = rooms.get(code)
    if (!room) return ack?.({ ok: false, error: 'gone' })
    let text = String(payload?.message || '').trim()
    if (!text) return ack?.({ ok: false, error: 'empty' })
    if (text.length > 500) text = text.slice(0, 500)
    const uid = String(socket.userId)
    const slot = room.slots.find((s) => s && s.userId === uid)
    if (!slot) return ack?.({ ok: false, error: 'not_in_room' })
    const msg = { userId: uid, name: slot.name, text, ts: Date.now() }
    room.chat.push(msg)
    if (room.chat.length > 50) room.chat.splice(0, room.chat.length - 50)
    io.to(roomChannel(code)).emit('wordScrambleLobby:chatMessage', msg)
    ack?.({ ok: true })
  })

  socket.on('wordScrambleLobby:start', async (_payload, ack) => {
    const code = currentRoomCode
    if (!code) return ack?.({ ok: false, error: 'no_room' })
    const room = rooms.get(code)
    if (!room) return ack?.({ ok: false, error: 'gone' })
    if (String(room.hostId) !== String(socket.userId)) {
      return ack?.({ ok: false, error: 'not_host' })
    }
    const occupied = room.slots.filter(Boolean)
    if (occupied.length === 0) return ack?.({ ok: false, error: 'empty' })
    if (!occupied.every((s) => s.ready)) return ack?.({ ok: false, error: 'not_all_ready' })

    // 1. Phát tín hiệu "Đang ghép trận" (Real Matchmaking phase)
    io.to(roomChannel(code)).emit('wordScrambleLobby:matching', {})

    try {
      // 2. Gọi AI để phân tích trận đấu (Sử dụng service đã tạo)
      const hostId = room.hostId
      const otherUserIds = occupied
        .filter(s => String(s.userId) !== String(hostId))
        .map(s => String(s.userId))
      
      const aiResult = await matchmakingService.callMatchmakingAI(hostId, otherUserIds, room.capacity)
      
      // 3. Phát tín hiệu "Bắt đầu" thực sự kèm theo kết quả AI (nếu cần)
      io.to(roomChannel(code)).emit('wordScrambleLobby:started', { aiResult })
      ack?.({ ok: true })
    } catch (err) {
      console.error('Matchmaking AI Failed:', err)
      // Nếu AI lỗi, vẫn cho bắt đầu game để không làm gián đoạn trải nghiệm
      io.to(roomChannel(code)).emit('wordScrambleLobby:started', {})
      ack?.({ ok: true })
    }
  })

  // --- GHÉP TRẬN TỰ ĐỘNG (QUICK MATCH) ---
  socket.on('wordScrambleLobby:findMatch', async (payload, ack) => {
    try {
      const capacity = Number(payload?.capacity)
      if (!ALLOWED_CAPACITIES.includes(capacity)) {
        return ack?.({ ok: false, error: 'invalid_capacity' })
      }

      leaveRoom()
      const profile = await loadProfile(socket.userId)
      const member = { ...profile, ready: true, socketId: socket.id }
      
      const queue = globalQueues.get(capacity)
      queue.push(member)
      console.log(`User ${socket.userId} joined global queue ${capacity} (Total: ${queue.length})`)

      ack?.({ ok: true })

      // Kích hoạt AI Matchmaking nếu đủ người tối thiểu (ví dụ: ít nhất bằng capacity)
      if (queue.length >= capacity) {
        await processMatchmaking(io, capacity)
      }
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'find_match_failed' })
    }
  })
}

/**
 * Xử lý hàng chờ dựa trên AI Matchmaking
 * @param {import('socket.io').Server} io
 * @param {number} capacity
 */
async function processMatchmaking(io, capacity) {
  const queue = globalQueues.get(capacity)
  if (!queue || queue.length < capacity) return

  try {
    const hostMember = queue[0]
    const others = queue.slice(1).map(m => String(m.userId))
    
    // Gọi AI để tìm nhóm tối ưu
    const aiResult = await matchmakingService.callMatchmakingAI(
      hostMember.userId, 
      others, 
      capacity
    )

    const matchIds = aiResult?.output?.ketQuaGhepNhom || []
    
    // Nếu AI tìm được đủ số lượng người chơi để lấp đầy phòng (khớp với capacity-1 cộng với host)
    if (matchIds.length > 0 && (matchIds.length + 1) === capacity) {
      const groupIds = [String(hostMember.userId), ...matchIds]
      const groupMembers = []

      // Lấy member từ queue và xóa khỏi queue
      for (const uid of groupIds) {
        const qIdx = queue.findIndex(m => String(m.userId) === uid)
        if (qIdx >= 0) {
          groupMembers.push(queue.splice(qIdx, 1)[0])
        }
      }

      if (groupMembers.length === capacity) {
        const code = newRoomCode()
        const room = {
          code,
          capacity,
          hostId: groupMembers[0].userId,
          slots: groupMembers.map(m => ({ ...m, ready: true })),
          chat: [],
        }
        rooms.set(code, room)

        // Thông báo cho từng thành viên chuyển vào game
        groupMembers.forEach(m => {
          io.to(m.socketId).emit('wordScrambleLobby:started', { 
            roomCode: code, 
            aiResult,
            isAutoMatched: true 
          })
        })
        console.log(`✅ Auto-match success: Room ${code} created for ${capacity} players.`)
      }
    }
  } catch (err) {
    console.error('Auto Matchmaking Logic Error:', err.message)
  }
}
