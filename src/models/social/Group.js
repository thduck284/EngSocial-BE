import mongoose from 'mongoose'

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true },
  description: { type: String, maxlength: 500 },
  icon: String,
  coverImage: String,
  color: String,
  type: {
    type: String,
    enum: ['public', 'private', 'invite_only'],
    default: 'public',
  },
  category: String,
  memberCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  rules: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
  },
}, { timestamps: true })

groupSchema.index({ name: 'text', description: 'text' })
groupSchema.index({ memberCount: -1 })
groupSchema.index({ category: 1, status: 1 })

export default mongoose.model('Group', groupSchema)
