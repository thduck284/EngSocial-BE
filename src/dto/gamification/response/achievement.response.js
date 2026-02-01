import { BaseDTO } from '../../base.dto.js'

export class AchievementDTO extends BaseDTO {
  constructor(achievement) {
    super({
      id: achievement._id?.toString() || achievement.id,
      key: achievement.key,
      name: achievement.name,
      nameVi: achievement.nameVi,
      description: achievement.description,
      descriptionVi: achievement.descriptionVi,
      icon: achievement.icon,
      color: achievement.color,
      type: achievement.type,
      skill: achievement.skill,
      requirement: achievement.requirement,
      xpReward: achievement.xpReward,
      rarity: achievement.rarity,
      order: achievement.order,
      active: achievement.active,
    })
  }
}

export class UserAchievementDTO extends BaseDTO {
  constructor(userAchievement) {
    super({
      id: userAchievement._id?.toString() || userAchievement.id,
      userId: userAchievement.userId?.toString(),
      achievementId: userAchievement.achievementId?.toString(),
      unlockedAt: userAchievement.unlockedAt,
      progress: userAchievement.progress,
      displayed: userAchievement.displayed,
    })
  }
}

export class ChallengeDTO extends BaseDTO {
  constructor(challenge) {
    super({
      id: challenge._id?.toString() || challenge.id,
      title: challenge.title,
      titleVi: challenge.titleVi,
      description: challenge.description,
      descriptionVi: challenge.descriptionVi,
      type: challenge.type,
      skill: challenge.skill,
      requirement: challenge.requirement,
      xpReward: challenge.xpReward,
      badge: challenge.badge,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      participantCount: challenge.participantCount,
      completedCount: challenge.completedCount,
      icon: challenge.icon,
      color: challenge.color,
      status: challenge.status,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt,
    })
  }
}

export class ChallengeParticipantDTO extends BaseDTO {
  constructor(participant) {
    super({
      id: participant._id?.toString() || participant.id,
      challengeId: participant.challengeId?.toString(),
      userId: participant.userId?.toString(),
      progress: participant.progress,
      target: participant.target,
      completed: participant.completed,
      rank: participant.rank,
      xpEarned: participant.xpEarned,
      joinedAt: participant.joinedAt,
      completedAt: participant.completedAt,
    })
  }
}

export class GameDTO extends BaseDTO {
  constructor(game) {
    super({
      id: game._id?.toString() || game.id,
      key: game.key,
      title: game.title,
      titleVi: game.titleVi,
      description: game.description,
      descriptionVi: game.descriptionVi,
      type: game.type,
      difficulty: game.difficulty,
      icon: game.icon,
      color: game.color,
      bgColor: game.bgColor,
      playCount: game.playCount,
      currentPlaying: game.currentPlaying,
      rating: game.rating,
      ratingCount: game.ratingCount,
      config: game.config,
      status: game.status,
      featured: game.featured,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    })
  }
}

export class GameSessionDTO extends BaseDTO {
  constructor(session) {
    super({
      id: session._id?.toString() || session.id,
      gameId: session.gameId?.toString(),
      userId: session.userId?.toString(),
      score: session.score,
      correctAnswers: session.correctAnswers,
      totalQuestions: session.totalQuestions,
      streak: session.streak,
      xpEarned: session.xpEarned,
      duration: session.duration,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    })
  }
}

export class LeaderboardSnapshotDTO extends BaseDTO {
  constructor(snapshot) {
    super({
      id: snapshot._id?.toString() || snapshot.id,
      type: snapshot.type,
      period: snapshot.period,
      entries: snapshot.entries,
      generatedAt: snapshot.generatedAt,
    })
  }
}
