import { User } from '../models/index.js'
import * as matchmakingService from '../services/matchmaking.service.js'
import { emitToUser, isUserOnline } from '../config/socket.js'

// Hàng chờ theo capacity (2, 4, 6, 8)
const globalQueues = new Map()
const processingFlags = new Map()
const ALLOWED_CAPACITIES = [2, 4, 6, 8]
ALLOWED_CAPACITIES.forEach((cap) => globalQueues.set(cap, []))

// Quản lý phòng game (Room) thực tế
export const rooms = new Map()

/** Phòng không còn ai: xóa sau TTL (ms) thay vì xóa ngay khi socket drop */
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000
const emptyRoomDeletionTimers = new Map()

function cancelEmptyRoomDeletion(code) {
  const t = emptyRoomDeletionTimers.get(code)
  if (t) {
    clearTimeout(t)
    emptyRoomDeletionTimers.delete(code)
  }
}

function scheduleEmptyRoomDeletion(io, code) {
  cancelEmptyRoomDeletion(code)
  const timer = setTimeout(() => {
    emptyRoomDeletionTimers.delete(code)
    const room = rooms.get(code)
    if (!room) return
    if (room.inGame) return
    if (room.slots.filter(Boolean).length === 0) {
      rooms.delete(code)
      console.log(`[Lobby] Room ${code} removed after ${EMPTY_ROOM_TTL_MS / 1000}s empty`)
    }
  }, EMPTY_ROOM_TTL_MS)
  emptyRoomDeletionTimers.set(code, timer)
}

/** Lưu snapshot người chơi trước khi client rời lobby (tránh mất slot khi disconnect). */
function markRoomInGame(room) {
  const occupied = room.slots.filter(Boolean)
  room.inGame = true
  room.playerSnapshot = occupied.map((s) => ({
    userId: String(s.userId),
    name: s.name,
    avatar: s.avatar || '',
    level: s.level,
  }))
  return room.playerSnapshot
}

const roomChannel = (code) => `room:${code}`

/** Phòng lobby socket đang tham gia — trên socket.data để merge có thể cập nhật (closure `currentRoomCode` không sửa được từ bên ngoài). */
function getLobbyRoomCode(s) {
  if (!s?.data) return null
  return s.data.__lobbyRoomCode ?? null
}
function setLobbyRoomCode(s, code) {
  if (!s) return
  if (!s.data) s.data = {}
  if (code == null || code === '') delete s.data.__lobbyRoomCode
  else s.data.__lobbyRoomCode = code
}

/** Sau merge: mọi socket vẫn trỏ phòng `fromCode` → join `toCode` + cập nhật data (mọi tab cùng user trong phòng cũ). */
function reassignSocketsAfterRoomMerge(io, fromCode, toCode) {
  if (!fromCode || !toCode || fromCode === toCode) return
  for (const s of io.sockets.sockets.values()) {
    if (getLobbyRoomCode(s) !== fromCode) continue
    try {
      s.leave(roomChannel(fromCode))
    } catch {
      /* ignore */
    }
    try {
      s.join(roomChannel(toCode))
    } catch {
      /* ignore */
    }
    setLobbyRoomCode(s, toCode)
  }
}

/**
 * Gửi event tới kênh phòng + room cá nhân user (mỗi user 1 lần).
 * Không gọi thêm io.to(socketId) vì socket lobby đã join user:id — tránh cùng client nhận 2–3 lần (matchingEnd lặp).
 */
function broadcastLobbyEventToRoom(io, code, room, event, payload = {}) {
  io.to(roomChannel(code)).emit(event, payload)
  for (const slot of Array.isArray(room?.slots) ? room.slots : []) {
    if (slot?.userId) emitToUser(io, String(slot.userId).trim(), event, payload)
  }
}

/** Đồng bộ state lobby — room + user:id từng slot. */
function broadcastRoomState(io, code, room) {
  if (!code || !room) return
  const findingMatch = !!room.findingMatch
  const payload = sanitizeObject({ ...room, findingMatch })
  io.to(roomChannel(code)).emit('wordScrambleLobby:state', payload)
  for (const slot of Array.isArray(room?.slots) ? room.slots : []) {
    if (slot?.userId) emitToUser(io, String(slot.userId).trim(), 'wordScrambleLobby:state', payload)
  }
}

/** Bắt đầu trận — room + user:id. */
function broadcastWordScrambleStarted(io, code, room, startedPayload) {
  io.to(roomChannel(code)).emit('wordScrambleLobby:started', startedPayload)
  for (const slot of Array.isArray(room?.slots) ? room.slots : []) {
    if (slot?.userId) emitToUser(io, String(slot.userId).trim(), 'wordScrambleLobby:started', startedPayload)
  }
}

const loadProfile = async (userId) => {
  const user = await User.findById(userId).select('name avatar level').lean()
  return {
    userId: user?._id?.toString() || userId,
    name: user?.name || 'Unknown',
    avatar: user?.avatar || '',
    level: user?.level || 1,
  }
}

const newRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

/**
 * To prevent 'Maximum call stack size exceeded' if circular references creep in.
 */
const sanitizeObject = (obj) => {
  if (!obj) return obj
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (err) {
    console.error('[Lobby] [ERROR] Circular reference or too deep object in emit:', err.message)
    return { error: 'data_serialization_failed' }
  }
}

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

    // Chuẩn bị profiles cho những người trong hàng chờ
    const queueProfiles = await Promise.all(
      others.map(uid => matchmakingService.getMatchmakingProfile(uid, capacity))
    )

    // GỌI AI VỚI PROFILES ĐÃ CHUẨN BỊ
    const aiResult = await matchmakingService.callMatchmakingAI(
      hostMember.userId,
      queueProfiles,
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
        findingMatch: false,
      }
      cancelEmptyRoomDeletion(code)
      rooms.set(code, room)
      markRoomInGame(room)

      groupMembers.forEach(m => {
        const otherMembersIds = groupMembers
          .filter(gm => String(gm.userId) !== String(m.userId))
          .map(gm => gm.userId)

        io.in(`user:${m.userId}`).socketsJoin(roomChannel(code))

        console.log(`[Lobby] Notifying User Room 'user:${m.userId}' (Socket ${m.socketId}) to start Game...`)
        io.to(`user:${m.userId}`).emit('wordScrambleLobby:started', sanitizeObject({
          roomCode: code,
          aiResult,
          isAutoMatched: true,
          matchCount: actualCapacity,
          others: otherMembersIds,
          fullRoom: room
        }))
      })

      // GỬI CHỐT LẦN CUỐI QUA KÊNH TOÀN CỤC PHÒNG TRƯỜNG HỢP CÁ NHÂN THẤT BẠI
      io.emit('wordScrambleLobby:matchFoundGlobal', sanitizeObject({
        roomCode: code,
        userIds: groupIds,
        fullRoom: room
      }))

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
    const uid = String(socket.userId).trim()
    socket.join(`user:${uid}`)
    console.log(`[Lobby] Socket ${socket.id} joined personal room 'user:${uid}'`)
  }

  // GIA NHẬP KÊNH LOBBY CHUNG ĐỂ NHẬN THÔNG BÁO GHÉP TRẬN
  socket.join('room:lobby')

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
    const cur = getLobbyRoomCode(socket)
    if (cur) {
      const room = rooms.get(cur)
      if (room) {
        if (room.inGame) {
          // Trận đã bắt đầu — giữ slots/snapshot cho game socket, chỉ rời kênh lobby
        } else {
          // Gán slot = null, KHÔNG dùng filter: filter bỏ cả ô null → mảng co lại → join báo 'full'.
          const idx = room.slots.findIndex((s) => s && s.socketId === socket.id)
          if (idx >= 0) room.slots[idx] = null
          if (room.slots.filter(Boolean).length === 0) {
            scheduleEmptyRoomDeletion(io, cur)
          } else {
            cancelEmptyRoomDeletion(cur)
            io.to(roomChannel(cur)).emit('wordScrambleLobby:state', sanitizeObject(room))
          }
        }
      }
      socket.leave(roomChannel(cur))
      setLobbyRoomCode(socket, null)
    }
    for (const queue of globalQueues.values()) {
      const idx = queue.findIndex((m) => m && m.socketId === socket.id)
      if (idx >= 0) queue.splice(idx, 1)
    }
  }

  socket.on('disconnect', () => leaveRoom())

  socket.on('wordScrambleLobby:leave', () => {
    leaveRoom()
  })

  socket.on('wordScrambleLobby:create', async (payload, ack) => {
    try {
      const capacity = Number(payload?.capacity)
      if (!ALLOWED_CAPACITIES.includes(capacity)) return ack?.({ ok: false, error: 'invalid_capacity' })
      leaveRoom()
      const code = newRoomCode()
      const profile = await loadProfile(socket.userId)
      const slots = new Array(capacity).fill(null)
      slots[0] = { ...profile, ready: false, socketId: socket.id, joinedAt: Date.now() }
      const room = { code, capacity, hostId: socket.userId, slots, chat: [], findingMatch: false }
      cancelEmptyRoomDeletion(code)
      rooms.set(code, room)
      setLobbyRoomCode(socket, code)
      socket.join(roomChannel(code))
      ack?.({ ok: true, roomCode: code, state: sanitizeObject(room) })
      socket.emit('wordScrambleLobby:state', sanitizeObject(room))
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'create_failed' })
    }
  })

  socket.on('wordScrambleLobby:join', async (payload, ack) => {
    try {
      const code = String(payload?.roomCode || '').toUpperCase()
      const room = rooms.get(code)
      if (!room) return ack?.({ ok: false, error: 'not_found' })
      // Phòng cũ có thể bị co slots do bug filter trước đây — chèn lại ô trống cho đủ capacity.
      if (Array.isArray(room.slots) && room.slots.length < room.capacity) {
        while (room.slots.length < room.capacity) room.slots.push(null)
      }

      // Đã ở đúng phòng (merge / đổi URL) — cập nhật socketId, không leaveRoom (tránh mất slot / lobby 3 người lệch)
      if (getLobbyRoomCode(socket) === code) {
        const myIdx = room.slots.findIndex((s) => s && String(s.userId) === String(socket.userId))
        if (myIdx >= 0) {
          const existing = room.slots[myIdx]
          room.slots[myIdx] = {
            ...existing,
            socketId: socket.id,
            ...(existing.socketId !== socket.id ? { joinedAt: Date.now() } : {}),
          }
          setLobbyRoomCode(socket, code)
          socket.join(roomChannel(code))
          cancelEmptyRoomDeletion(code)
          ack?.({ ok: true, state: sanitizeObject(room) })
          io.to(roomChannel(code)).emit('wordScrambleLobby:state', sanitizeObject(room))
          return
        }
      }

      const emptySlotIdx = room.slots.findIndex((s) => s === null)
      if (emptySlotIdx === -1) return ack?.({ ok: false, error: 'full' })
      leaveRoom()
      const profile = await loadProfile(socket.userId)
      room.slots[emptySlotIdx] = { ...profile, ready: false, socketId: socket.id, joinedAt: Date.now() }
      cancelEmptyRoomDeletion(code)
      setLobbyRoomCode(socket, code)
      socket.join(roomChannel(code))
      ack?.({ ok: true, state: sanitizeObject(room) })
      io.to(roomChannel(code)).emit('wordScrambleLobby:state', sanitizeObject(room))
    } catch (e) {
      ack?.({ ok: false, error: e?.message || 'join_failed' })
    }
  })

  socket.on('wordScrambleLobby:setReady', (payload) => {
    const cur = getLobbyRoomCode(socket)
    if (!cur) return
    const room = rooms.get(cur)
    const slot = room?.slots.find((s) => s?.socketId === socket.id)
    if (slot) {
      slot.ready = !!payload?.ready
      io.to(roomChannel(cur)).emit('wordScrambleLobby:state', sanitizeObject(room))
    }
  })

  socket.on('wordScrambleLobby:chat', (payload) => {
    const cur = getLobbyRoomCode(socket)
    if (!cur) return
    const room = rooms.get(cur)
    const profile = room?.slots.find((s) => s?.socketId === socket.id)
    if (profile && payload?.text) {
      const msg = { userId: socket.userId, name: profile.name, text: String(payload.text).substring(0, 200), ts: Date.now() }
      room.chat.push(msg)
      if (room.chat.length > 50) room.chat.shift()
      io.to(roomChannel(cur)).emit('wordScrambleLobby:chatMessage', msg)
    }
  })

  socket.on('wordScrambleLobby:start', async (_payload, ack) => {
    const code = getLobbyRoomCode(socket)
    const room = rooms.get(code || '')
    if (!room || String(room.hostId) !== String(socket.userId)) {
      return ack?.({ ok: false, error: 'no_room_or_not_host' })
    }

    // ĐẢM BẢO HOST LUÔN CÓ MẶT TRONG SLOTS (Phòng hờ lỗi mất dấu)
    let hostIdx = room.slots.findIndex(s => s && String(s.userId) === String(socket.userId))
    if (hostIdx === -1) {
      console.log(`[Lobby] [WARN] Host ${socket.userId} missing from slots! Re-inserting into slot 0.`)
      const profile = await loadProfile(socket.userId)
      room.slots[0] = { ...profile, ready: true, socketId: socket.id, joinedAt: Date.now() }
    } else {
      room.slots[hostIdx].ready = true // Host ấn Start là mặc định Ready
    }

    const occupied = room.slots.filter(Boolean)
    console.log(`[Lobby] [Start] Room ${code} has ${occupied.length} people before merge:`, occupied.map(o => o.name))

    // KIỂM TRA TẤT CẢ THÀNH VIÊN TRONG PHÒNG ĐÃ READY CHƯA
    const allReady = occupied.every(s => s.ready)
    if (!allReady) {
      return ack?.({ ok: false, error: 'players_not_ready' })
    }

    // Đủ đúng party size → không gọi AI / không ghép thêm, vào trận luôn (không bật findingMatch)
    if (occupied.length >= room.capacity) {
      console.log(`[Lobby] [Private] Party full ${occupied.length}/${room.capacity} — skip AI, start game`)
      room.findingMatch = false
      if (room.lastMatchRequest) delete room.lastMatchRequest
      broadcastRoomState(io, code, room)
      const participantsIds = occupied.map(s => String(s.userId))
      markRoomInGame(room)
      const startedPayload = sanitizeObject({
        roomCode: code,
        aiResult: null,
        others: participantsIds,
        fullRoom: room,
      })
      broadcastWordScrambleStarted(io, code, room, startedPayload)
      return ack?.({ ok: true })
    }

    // ĐÁNH DẤU PHÒNG ĐANG TRONG TRẠNG THÁI TÌM TRẬN (Bật Radar) — findingMatch trong state để mọi client đồng bộ UI
    room.lastMatchRequest = Date.now()
    room.findingMatch = true
    broadcastRoomState(io, code, room)
    // Mọi người trong slots + kênh phòng (đồng bộ UI ghép; user: kênh đã dùng cho invite)
    broadcastLobbyEventToRoom(io, code, room, 'wordScrambleLobby:matching', {})
    console.log(`[Lobby] [Private] AI Polling for ${code}...`)
    
    const publicQueue = globalQueues.get(room.capacity) || []
    
    // Tìm các phòng Private khác (PHẢI CÓ RADAR ĐANG BẬT VÀ CÒN CHỖ TRỐNG)
    const otherRooms = Array.from(rooms.values()).filter(r => 
      r.code !== code && 
      r.capacity === room.capacity && 
      r.lastMatchRequest && (Date.now() - r.lastMatchRequest) < 10000 && 
      r.slots.filter(Boolean).length < r.capacity
    )

    // Chuẩn bị danh sách "Thực thể" (Entities) cho AI
    // 1. Entities từ sảnh chờ công khai (mỗi người 1 entity)
    const queueEntities = await Promise.all(publicQueue.map(m => matchmakingService.getMatchmakingProfile(m.userId, room.capacity)))
    
    // 2. Entities từ các phòng Private khác (mỗi phòng 1 entity gồm nhiều người)
    const otherRoomEntities = await Promise.all(otherRooms.map(async (r) => {
      const members = r.slots.filter(Boolean)
      const profiles = await Promise.all(members.map(m => matchmakingService.getMatchmakingProfile(m.userId, room.capacity)))
      return {
        entityId: `room:${r.code}`, // Đánh dấu đây là thực thể phòng
        users: profiles.flatMap(p => p.users)
      }
    }))

    const existingOtherUserIds = occupied.filter(s => String(s.userId) !== String(room.hostId)).map(s => String(s.userId))
    
    // Gọi AI với tất cả ứng viên
    const aiResult = await matchmakingService.callMatchmakingAI(
      room.hostId, 
      [...queueEntities, ...otherRoomEntities], 
      room.capacity
    ).catch(() => null)

    const matchEntityIdsFromAI = aiResult?.output?.ketQuaGhepNhom || []
    const occupiedCountBeforePull = occupied.length

    if (occupied.length < room.capacity && matchEntityIdsFromAI.length > 0) {
      for (const eid of matchEntityIdsFromAI) {
        if (occupied.length >= room.capacity) break
        
        if (eid.startsWith('room:')) {
          // KỊCH BẢN SÁP NHẬP PHÒNG
          const targetRoomCode = eid.split(':')[1]
          const targetRoom = rooms.get(targetRoomCode)
          if (targetRoom) {
            const incomingMembers = targetRoom.slots.filter(Boolean)
            if (occupied.length + incomingMembers.length <= room.capacity) {
              console.log(`[Lobby] [MERGE] Merging room ${targetRoomCode} into ${code}`)
              
              for (const member of incomingMembers) {
                const emptySlotIdx = room.slots.findIndex(s => s === null)
                if (emptySlotIdx >= 0) {
                  room.slots[emptySlotIdx] = { 
                    userId: String(member.userId), 
                    name: member.name, 
                    avatar: member.avatar,
                    socketId: member.socketId,
                    ready: true,
                    joinedAt: Date.now()
                  }
                  occupied.push(room.slots[emptySlotIdx])
                  
                  console.log(`[Lobby] [MERGE] Pulled member ${member.name} (${member.userId}) into room ${code} at slot ${emptySlotIdx}`)
                }
              }
              // Cập nhật mọi socket vẫn trỏ phòng bị merge (data + join room) — tránh setReady/chat/start dùng mã phòng đã xóa
              reassignSocketsAfterRoomMerge(io, targetRoomCode, code)
              // Giải tán phòng cũ
              cancelEmptyRoomDeletion(targetRoomCode)
              rooms.delete(targetRoomCode)
            }
          }
        } else {
          // KỊCH BẢN KÉO TỪ HÀNG CHỜ CÔNG KHAI (Như cũ)
          const qIdx = publicQueue.findIndex(m => String(m.userId) === eid)
          if (qIdx >= 0) {
            const matchedMember = publicQueue.splice(qIdx, 1)[0]
            const emptySlotIdx = room.slots.findIndex(s => s === null)
            if (emptySlotIdx >= 0) {
              room.slots[emptySlotIdx] = { ...matchedMember, ready: true }
              occupied.push(room.slots[emptySlotIdx])
              const qs = io.sockets.sockets.get(matchedMember.socketId)
              if (qs) {
                qs.join(roomChannel(code))
                setLobbyRoomCode(qs, code)
              }
            }
          }
        }
      }
    }

    // Người mới merge / kéo từ queue không có ở slots lúc broadcast đầu — bắn lại state + matching cho đủ socket
    if (occupied.length > occupiedCountBeforePull) {
      broadcastRoomState(io, code, room)
      broadcastLobbyEventToRoom(io, code, room, 'wordScrambleLobby:matching', {})
    }

    if (occupied.length < room.capacity) {
      console.log(`[Lobby] [Private] Matching in progress (${occupied.length}/${room.capacity})...`)
      return ack?.({ ok: false, error: 'not_enough_players' })
    }

    room.findingMatch = false
    if (room.lastMatchRequest) delete room.lastMatchRequest
    broadcastRoomState(io, code, room)

    // THÔNG BÁO CHO TẤT CẢ (BAO GỒM CẢ NHỮNG NGƯỜI MỚI ĐƯỢC PULL VÀO) — matching đã emit lúc bắt đầu poll
    const participantsIds = occupied.map(s => String(s.userId))
    markRoomInGame(room)
    const startedPayload = sanitizeObject({
      roomCode: code,
      aiResult,
      others: participantsIds,
      fullRoom: room
    })
    broadcastWordScrambleStarted(io, code, room, startedPayload)

    ack?.({ ok: true })
  })

  /** Chủ phòng hủy ghép trận (UI matching) — vẫn ở trong phòng, không xóa thành viên */
  socket.on('wordScrambleLobby:cancelStart', (_payload, ack) => {
    const code = getLobbyRoomCode(socket)
    if (!code) return ack?.({ ok: false, error: 'no_room' })
    const room = rooms.get(code)
    if (!room || String(room.hostId) !== String(socket.userId)) {
      return ack?.({ ok: false, error: 'not_host' })
    }
    if (room.lastMatchRequest) delete room.lastMatchRequest
    room.findingMatch = false
    broadcastLobbyEventToRoom(io, code, room, 'wordScrambleLobby:matchingEnd', {})
    broadcastRoomState(io, code, room)
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

  // MỜI BẠN BÈ VÀO PHÒNG
  socket.on('wordScrambleLobby:invite', async (payload, ack) => {
    const { friendId: rawFriendId, roomCode: rawCode, inviteUrl } = payload || {}
    const friendId = String(rawFriendId || '').trim()
    const roomCode = String(rawCode || '').trim().toUpperCase()
    if (!friendId || !roomCode) {
      return ack?.({ ok: false, error: 'missing_data' })
    }

    const room = rooms.get(roomCode)
    if (!room) {
      return ack?.({ ok: false, error: 'room_not_found' })
    }

    let inviterName = 'Ai đó'
    try {
      const profile = await loadProfile(socket.userId)
      inviterName = profile?.name || 'Ai đó'
    } catch {
      /* ignore */
    }

    const friendOnline = isUserOnline(String(friendId))
    emitToUser(io, friendId, 'wordScrambleLobby:inviteReceived', {
      inviterName,
      inviterId: socket.userId,
      roomCode,
      inviteUrl,
    })

    console.log(`[Lobby] [Invite] ${inviterName} invited ${friendId} to ${roomCode} (friendOnline=${friendOnline})`)
    ack?.({ ok: true, friendOnline })
  })
}
