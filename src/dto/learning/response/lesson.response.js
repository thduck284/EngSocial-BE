import { BaseDTO } from '../../base.dto.js'

export class SkillDTO extends BaseDTO {
  constructor(skill) {
    super({
      id: skill._id?.toString() || skill.id,
      key: skill.key,
      name: skill.name,
      nameVi: skill.nameVi,
      icon: skill.icon,
      description: skill.description,
      descriptionVi: skill.descriptionVi,
      color: skill.color,
      order: skill.order,
    })
  }
}

export class LessonDTO extends BaseDTO {
  constructor(lesson) {
    super({
      id: lesson._id?.toString() || lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      category: lesson.category || 'lesson',
      skill: lesson.skill,
      level: lesson.level,
      topic: lesson.topic,
      description: lesson.description,
      thumbnail: lesson.thumbnail,
      estimatedTime: lesson.estimatedTime,
      xpReward: lesson.xpReward,
      totalQuestions: lesson.totalQuestions,
      rating: lesson.rating,
      ratingCount: lesson.ratingCount,
      completionCount: lesson.completionCount,
      status: lesson.status,
      featured: lesson.featured,
      tags: lesson.tags,
      time: lesson.time,
      questions: lesson.totalQuestions ? `${lesson.totalQuestions} Questions` : '',
      accent: lesson.accent,
      type: lesson.practiceType,
      practiceType: lesson.practiceType,
      length: lesson.length,
      order: lesson.order,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    })
  }
}

export class LessonDetailDTO extends BaseDTO {
  constructor(lesson) {
    const content = lesson.content || {}
    const accent = content.accent || lesson.accent || ''
    super({
      id: lesson._id?.toString() || lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      skill: lesson.skill,
      level: lesson.level,
      topic: lesson.topic,
      description: lesson.description,
      thumbnail: lesson.thumbnail,
      content: { ...content, accent },
      questions: lesson.questions,
      vocabulary: lesson.vocabulary,
      estimatedTime: lesson.estimatedTime,
      xpReward: lesson.xpReward,
      totalQuestions: lesson.totalQuestions,
      rating: lesson.rating,
      ratingCount: lesson.ratingCount,
      completionCount: lesson.completionCount,
      status: lesson.status,
      featured: lesson.featured,
      tags: lesson.tags,
      category: lesson.category,
      time: lesson.time,
      practiceType: lesson.practiceType,
      length: lesson.length,
      order: lesson.order,
      accent: accent,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    })
  }
}

export class UserLessonProgressDTO extends BaseDTO {
  constructor(progress) {
    super({
      id: progress._id?.toString() || progress.id,
      userId: progress.userId?.toString(),
      lessonId: progress.lessonId?.toString(),
      status: progress.status,
      progress: progress.progress,
      currentPosition: progress.currentPosition,
      currentChapter: progress.currentChapter,
      score: progress.score,
      maxScore: progress.maxScore,
      xpEarned: progress.xpEarned,
      attempts: progress.attempts,
      bestScore: progress.bestScore,
      timeSpent: progress.timeSpent,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      lastAccessedAt: progress.lastAccessedAt,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    })
  }
}

export class UserSkillStatsDTO extends BaseDTO {
  constructor(stats) {
    super({
      id: stats._id?.toString() || stats.id,
      userId: stats.userId?.toString(),
      skill: stats.skill,
      totalTimeSpent: stats.totalTimeSpent,
      weeklyTimeSpent: stats.weeklyTimeSpent,
      dailyTimeSpent: stats.dailyTimeSpent,
      lessonsCompleted: stats.lessonsCompleted,
      lessonsInProgress: stats.lessonsInProgress,
      averageScore: stats.averageScore,
      highestScore: stats.highestScore,
      totalXpEarned: stats.totalXpEarned,
      skillLevel: stats.skillLevel,
      lastActivityAt: stats.lastActivityAt,
      createdAt: stats.createdAt,
      updatedAt: stats.updatedAt,
    })
  }
}

export class UserDailyGoalDTO extends BaseDTO {
  constructor(goal) {
    super({
      id: goal._id?.toString() || goal.id,
      userId: goal.userId?.toString(),
      date: goal.date,
      goals: goal.goals,
      allCompleted: goal.allCompleted,
      xpBonus: goal.xpBonus,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    })
  }
}
