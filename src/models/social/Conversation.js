import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
  /** Tên nhóm (chỉ dùng khi type === 'group') */
  name: { type: String, default: '' },
  /** Avatar nhóm (URL, chỉ khi type === 'group') */
  avatar: { type: String, default: '' },
  /** Số thành viên tối đa (chỉ khi type === 'group'), mặc định 50 */
  maxMembers: { type: Number, default: 50 },
  /** Role từng thành viên (chỉ khi type === 'group'). host: 1, admin: có thể nhiều, user: còn lại */
  participantRoles: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['host', 'admin', 'user'], default: 'user' },
  }],
  /** Phân quyền nhóm (chỉ khi type === 'group'). Host cấp cho Admin; Admin/Host cấp cho User. */
  groupPermissions: {
    /** Admin được phép kick thành viên */
    adminCanKick: { type: Boolean, default: true },
    /** Admin được phép thêm thành viên (mời vào nhóm) */
    adminCanAddMembers: { type: Boolean, default: true },
    /** Admin được phép sửa thông tin nhóm (tên, avatar, số thành viên tối đa) */
    adminCanEditGroupInfo: { type: Boolean, default: false },
    /** Admin được phép gán quyền cho user */
    adminCanAssignUserPermissions: { type: Boolean, default: false },
    /** Admin được phép chặn user (block) khỏi nhóm */
    adminCanBlockUser: { type: Boolean, default: true },
    /** User được phép thêm thành viên vào nhóm (đầy đủ như admin trừ kick và gán quyền) */
    userCanAddMembers: { type: Boolean, default: false },
    /** User được phép sửa thông tin nhóm */
    userCanEditGroupInfo: { type: Boolean, default: false },
  },
  /** Thành viên bị chặn khỏi nhóm (chỉ type === 'group'). Đã bị kick và không thể vào lại cho đến khi unblock. */
  blockedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

// Không dùng unique index trên participants+type để cho phép nhiều nhóm trùng thành viên.
// Direct: getOrCreateConversation đã tìm trước khi tạo nên không tạo trùng.

export default mongoose.model('Conversation', conversationSchema)
