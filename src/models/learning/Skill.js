import mongoose from 'mongoose'

const skillSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ['reading', 'listening', 'writing', 'speaking'],
    required: true,
    unique: true,
  },
  name: { type: String, required: true },
  nameVi: String,
  icon: { type: String, required: true },
  description: String,
  descriptionVi: String,
  color: String,
  order: { type: Number, default: 0 },
})

export default mongoose.model('Skill', skillSchema)
