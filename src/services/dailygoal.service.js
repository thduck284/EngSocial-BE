import { UserDailyGoal } from '../models/index.js'
import { User } from '../models/index.js'

/**
 * Get today's goals for a user. If not yet created, generates them.
 */
export const getTodayGoals = async (userId) => {
  const today = getStartOfDay()
  let dailyGoal = await UserDailyGoal.findOne({ userId, date: today })
  if (!dailyGoal) {
    dailyGoal = await generateDailyGoals(userId, today)
  }
  return dailyGoal
}

/**
 * Generate daily goals for a user
 */
export const generateDailyGoals = async (userId, date) => {
  const today = date || getStartOfDay()

  const goals = [
    {
      id: 'lessons',
      type: 'lessons',
      description: 'Complete 3 lessons',
      target: 3,
      current: 0,
      completed: false,
    },
    {
      id: 'xp',
      type: 'xp',
      description: 'Earn 50 XP',
      target: 50,
      current: 0,
      completed: false,
    },
    {
      id: 'time',
      type: 'time',
      description: 'Study for 15 minutes',
      target: 15,
      current: 0,
      completed: false,
    },
  ]

  const dailyGoal = await UserDailyGoal.findOneAndUpdate(
    { userId, date: today },
    { goals, allCompleted: false, xpBonus: 0 },
    { upsert: true, new: true }
  )

  return dailyGoal
}

/**
 * Update progress on a specific goal
 */
export const updateGoalProgress = async (userId, goalId, increment = 1) => {
  const today = getStartOfDay()
  let dailyGoal = await UserDailyGoal.findOne({ userId, date: today })
  if (!dailyGoal) {
    dailyGoal = await generateDailyGoals(userId, today)
  }

  const goal = dailyGoal.goals.find(g => g.id === goalId)
  if (!goal) {
    throw new Error('GOAL_NOT_FOUND')
  }

  goal.current = Math.min(goal.current + increment, goal.target)
  if (goal.current >= goal.target && !goal.completed) {
    goal.completed = true
    goal.completedAt = new Date()
  }

  // Check if all goals completed
  const allDone = dailyGoal.goals.every(g => g.completed)
  if (allDone && !dailyGoal.allCompleted) {
    dailyGoal.allCompleted = true
    dailyGoal.xpBonus = 30
    // Award bonus XP to user
    await User.findByIdAndUpdate(userId, { $inc: { xp: 30 } })
  }

  await dailyGoal.save()
  return dailyGoal
}

/**
 * Get goal history for a user
 */
export const getGoalHistory = async (userId, { page = 1, limit = 10 }) => {
  const { getPaginationQuery, getPagination } = await import('../utils/pagination.js')
  const { skip, limit: perPage } = getPaginationQuery({ page, limit })

  const [goals, total] = await Promise.all([
    UserDailyGoal.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(perPage),
    UserDailyGoal.countDocuments({ userId }),
  ])

  return {
    goals,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Helper: get start of today (UTC midnight)
 */
function getStartOfDay() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
