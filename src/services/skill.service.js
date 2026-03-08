import { Skill } from '../models/index.js'
import { SkillDTO } from '../dto/index.js'

/**
 * Get all skills
 */
export const getSkills = async () => {
  const skills = await Skill.find().sort({ order: 1 })
  return skills.map(s => new SkillDTO(s))
}

/**
 * Get skill by key
 */
export const getSkillByKey = async (key) => {
  const skill = await Skill.findOne({ key })
  if (!skill) throw new Error('SKILL_NOT_FOUND')
  return new SkillDTO(skill)
}

/**
 * Create skill (admin only)
 */
export const createSkill = async (data) => {
  const existing = await Skill.findOne({ key: data.key })
  if (existing) throw new Error('SKILL_EXISTS')
  const skill = await Skill.create(data)
  return new SkillDTO(skill)
}
