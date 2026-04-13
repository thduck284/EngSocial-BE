import { User } from '../models/index.js'
import * as matchmakingService from '../services/matchmaking.service.js'

// Hàng chờ theo capacity (2, 4, 6, 8)
const globalQueues = new Map()
const processingFlags = new Map()
const ALLOWED_CAPACITIES = [2, 4, 6, 8]
ALLOWED_CAPACITIES.forEach((cap) => globalQueues.set(cap, []))

// Quản lý phòng game (Room) thực tế
export const rooms = new Map()

const roomChannel = (code) => `room:${code}`

const loadProfile = async (userId) => {
  const user = await User.findById(userId).select('name avatar level').lean()
  return {
    userId: user._id.toString(),
    name: user.name || 'Unknown',
    avatar: user.avatar || '',
    level: user.level || 1,
  }
}

const newRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

// Biến để kiểm tra xem interval quét hàng chờ đã được chạy chưa (tránh chạy nhiều lần)
let intervalStarted = false

/**
 * Xử lý hàng chờ dựa trên AI Matchmaking
 */
async function processMatchmaking(io, capacity) {
  if (processingFlags.get(capacity)) return
  const queue = globalQueues.get(capacity)
  if (!queue || queue.length === 0) return
  processingFlags.set(capacity, true)

  const oldestMember = queue[0]
  const waitTime = Date.now() - (oldestMember.joinedAt || 0)

  try {
    const currentBatchSize = Math.min(queue.length, capacity)
    const activeBatch = queue.slice(0, currentBatchSize)
    const hostMember = activeBatch[0]
    const others = activeBatch.slice(1).map(m => String(m.userId))

    // LUÔN GỌI AI ĐỂ THẤY REQUEST (Mỗi lần quét 3s đều gọi sang AI)
    const aiResult = await matchmakingService.callMatchmakingAI(
      hostMember.userId,
      others,
      capacity
    ).catch(() => null)

    const actualInQueue = others.length + 1
    const matchIdsFromAI = aiResult?.output?.ketQuaGhepNhom || []

    // AI phải tìm đủ số người còn thiếu để lấp đầy capacity
    const isMatchedByAI = (matchIdsFromAI.length + 1 >= capacity)

    // CHỐT CHẶN: Chỉ thực sự tạo phòng nếu (AI tìm đủ) HOẶC (Đủ người tự nhiên)
    if (!isMatchedByAI && actualInQueue < capacity) {
      console.log(`[Lobby] [QuickMatch] Waiting for full group (${actualInQueue}/${capacity}) - Searching for ${Math.floor(waitTime / 1000)}s...`)
      return
    }

    console.log(`[Lobby] [QuickMatch] Match Found! Reason: ${isMatchedByAI ? 'AI Matched' : 'Queue Full'}`)

    let matchIds = matchIdsFromAI
    if (matchIds.length === 0 && others.length > 0) {
      matchIds = others.slice(0, capacity - 1)
    }

    const groupIds = [String(hostMember.userId), ...matchIds]
    const groupMembers = []

    for (const uid of groupIds) {
      const qIdx = queue.findIndex(m => String(m.userId) === uid)
      if (qIdx >= 0) {
        groupMembers.push(queue.splice(qIdx, 1)[0])
      }
    }

    if (groupMembers.length < capacity) {
      // Not enough members extracted (AI result stale / user left). Put them back and wait.
      queue.push(...groupMembers)
      return
    }

    if (groupMembers.length === capacity) {
      const actualCapacity = groupMembers.length
      const code = newRoomCode()
      const room = {
        code,
        capacity: capacity,
        actualCapacity: actualCapacity,
        hostId: groupMembers[0].userId,
        slots: groupMembers.map(m => ({ ...m, ready: true })),
        chat: [],
      }
      rooms.set(code, room)

      groupMembers.forEach(m => {
        const otherMembersIds = groupMembers
          .filter(gm => String(gm.userId) !== String(m.userId))
          .map(gm => gm.userId)

        io.in(`user:${m.userId}`).socketsJoin(roomChannel(code))

        console.log(`[Lobby] Notifying User Room 'user:${m.userId}' (Socket ${m.socketId}) to start Game...`)
        io.to(`user:${m.userId}`).emit('wordScrambleLobby:started', {
          roomCode: code,
          aiResult,
          isAutoMatched: true,
          matchCount: actualCapacity,
          others: otherMembersIds,
          fullRoom: room
        })
      })

      // GỬI CHỐT LẦN CUỐI QUA KÊNH TOÀN CỤC PHÒNG TRƯỜNG HỢP CÁ NHÂN THẤT BẠI
      io.emit('wordScrambleLobby:matchFoundGlobal', {
        roomCode: code,
        userIds: groupIds,
        fullRoom: room
      })

      console.log(`✅ Match Success: Room ${code} created for IDs: ${groupIds.join(', ')}`)
    }
  } catch (err) {
    console.error('Matchmaking Logic Error:', err.message)
  } finally {
    processingFlags.set(capacity, false)
  }
}

export function registerWordScrambleLobbyHandlers(io, socket) {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`)
    console.log(`[Lobby] Socket ${socket.id} joined personal room 'user:${socket.userId}'`)
  }

  // GIA NHẬP KÊNH LOBBY CHUNG ĐỂ NHẬN THÔNG BÁO GHÉP TRẬN
  socket.join('room:lobby')

  let currentRoomCode = null

  // Khởi động vòng lặp quét hàng chờ chỉ 1 lần duy nhất
  if (!intervalStarted) {
    intervalStarted = true
    setInterval(() => {
      const currentIo = global.ioInstance || io
      for (const cap of ALLOWED_CAPACITIES) {
        processMatchmaking(currentIo, cap).catch(() => { })
      }
    }, 3000)
  }

  const leaveRoom = () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode)
      if (room) {
        room.slots = room.slots.filter((s) => s && s.socketId !== socket.id)
        if (room.slots.filter(Boolean).length === 0) {
          rooms.delete(currentRoomCode)
        } else {
          io.to(roomChannel(currentRoomCode)).emit('wordScrambleLobby:state', room)
        }
      }
      socket.leave(roomChannel(currentRoomCode))
      currentRoomCode = null
    }
    for (const queue of globalQueues.values()) {
      const idx = queue.findIndex((m) => m && m.socketId === socket.id)
      if (idx >= 0) queue.splice(idx, 1)
    }
  }

  socket.on('disconnect', () => leaveRoom())

  socket.on('wordScrambleLobby:create', async (payload, ack) => {
    try {
      const capacity = Number(payload?.capacity)
      if (!ALLOWED_CAPACITIES.includes(capacity)) return ack?.({ ok: false, error: 'invalid_capacity' })
      leaveRoom()
      const code = newRoomCode()
      const profile = await loadProfile(socket.userId)
      const slots = new Array(capacity).fill(null)
      slots[0] = { ...profile, ready: false, socketId: socket.id, joinedAt: Date.now() }
      const room = { code, capacity, hostId: socket.userId, slots, chat: [] }
      rooms.set(code, room)
      currentRoomCode = code
      socket.join(roomChannel(code))
      ack?.({ ok: true, roomCode: code })
      socket.emit('wordScrambleLobby:state', room)
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'create_failed' })
    }
  })

  socket.on('wordScrambleLobby:join', async (payload, ack) => {
    try {
      const code = String(payload?.roomCode || '').toUpperCase()
      const room = rooms.get(code)
      if (!room) return ack?.({ ok: false, error: 'not_found' })
      const emptySlotIdx = room.slots.findIndex((s) => s === null)
      if (emptySlotIdx === -1) return ack?.({ ok: false, error: 'full' })
      leaveRoom()
      const profile = await loadProfile(socket.userId)
      room.slots[emptySlotIdx] = { ...profile, ready: false, socketId: socket.id, joinedAt: Date.now() }
      currentRoomCode = code
      socket.join(roomChannel(code))
      ack?.({ ok: true })
      io.to(roomChannel(code)).emit('wordScrambleLobby:state', room)
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'join_failed' })
    }
  })

  socket.on('wordScrambleLobby:setReady', (payload) => {
    if (!currentRoomCode) return
    const room = rooms.get(currentRoomCode)
    const slot = room?.slots.find((s) => s?.socketId === socket.id)
    if (slot) {
      slot.ready = !!payload?.ready
      io.to(roomChannel(currentRoomCode)).emit('wordScrambleLobby:state', room)
    }
  })

  socket.on('wordScrambleLobby:chat', (payload) => {
    if (!currentRoomCode) return
    const room = rooms.get(currentRoomCode)
    const profile = room?.slots.find((s) => s?.socketId === socket.id)
    if (profile && payload?.text) {
      const msg = { userId: socket.userId, name: profile.name, text: String(payload.text).substring(0, 200), ts: Date.now() }
      room.chat.push(msg)
      if (room.chat.length > 50) room.chat.shift()
      io.to(roomChannel(currentRoomCode)).emit('wordScrambleLobby:chatMessage', msg)
    }
  })

  socket.on('wordScrambleLobby:start', async (_payload, ack) => {
    const code = currentRoomCode
    const room = rooms.get(code || '')
    if (!room || String(room.hostId) !== String(socket.userId)) {
      return ack?.({ ok: false, error: 'no_room_or_not_host' })
    }
    const occupied = room.slots.filter(Boolean)
    const hostJoinInfo = occupied.find(s => String(s.userId) === String(room.hostId))
    const waitTime = hostJoinInfo?.joinedAt ? (Date.now() - hostJoinInfo.joinedAt) : 0

    // GỌI AI NGAY LẬP TỨC ĐỂ HIỆN REQUEST
    console.log(`[Lobby] [Private] AI Polling for ${code}...`)
    const otherUserIds = occupied.filter(s => String(s.userId) !== String(room.hostId)).map(s => String(s.userId))
    const aiResult = await matchmakingService.callMatchmakingAI(room.hostId, otherUserIds, room.capacity).catch(() => null)

    // Private room must start only when room itself is full.
    if (occupied.length < room.capacity) {
      console.log(`[Lobby] [Private] Waiting for more members (${occupied.length}/${room.capacity}) - Searching for ${Math.round(waitTime / 1000)}s...`)
      return ack?.({ ok: false, error: 'not_enough_players' })
    }

    console.log(`[Lobby] [Private] Success! Starting match with participants: ${occupied.map(s => String(s.userId)).join(', ')}`)

    // Thông báo cho cả phòng vào game
    const participantsIds = occupied.map(s => String(s.userId))

    io.to(roomChannel(code)).emit('wordScrambleLobby:matching', {})
    io.to(roomChannel(code)).emit('wordScrambleLobby:started', {
      roomCode: code,
      aiResult,
      others: participantsIds,
      fullRoom: room
    })

    ack?.({ ok: true })
  })

  socket.on('wordScrambleLobby:findMatch', async (payload, ack) => {
    try {
      const capacity = Number(payload?.capacity)
      if (!ALLOWED_CAPACITIES.includes(capacity)) return ack?.({ ok: false, error: 'invalid_capacity' })
      leaveRoom()
      const profile = await loadProfile(socket.userId)
      const member = { ...profile, ready: true, socketId: socket.id, joinedAt: Date.now() }
      const queue = globalQueues.get(capacity)
      queue.push(member)
      console.log(`User ${socket.userId} joined queue ${capacity} (Total: ${queue.length})`)
      ack?.({ ok: true })

      // GỌI AI NGAY LẬP TỨC KHI CÓ NGƯỜI VÔ THAY VÌ ĐỢI QUÉT
      await processMatchmaking(io, capacity)
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'find_match_failed' })
    }
  })
}
