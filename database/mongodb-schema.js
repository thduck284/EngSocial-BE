/**
 * EngSocial - MongoDB Atlas Database Schema
 * 
 * Run this file in MongoDB Shell to create collections with validation
 * Command: mongosh "mongodb+srv://<cluster>.mongodb.net/engsocial" --apiVersion 1 --username <username> < database/mongodb-schema.js
 */

// ============================================
// DATABASE: engsocial
// ============================================

// Drop existing database (WARNING: Use only in development)
// db.dropDatabase()

// ============================================
// 1. USERS COLLECTION
// ============================================
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "password", "name", "createdAt"],
      properties: {
        _id: { bsonType: "objectId" },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "User email - must be unique and valid format"
        },
        password: {
          bsonType: "string",
          minLength: 8,
          description: "Hashed password"
        },
        name: {
          bsonType: "string",
          minLength: 2,
          maxLength: 100,
          description: "Display name"
        },
        avatar: {
          bsonType: "string",
          description: "Avatar URL"
        },
        bio: {
          bsonType: "string",
          maxLength: 500
        },
        level: {
          bsonType: "int",
          minimum: 1,
          maximum: 100,
          description: "User level"
        },
        xp: {
          bsonType: "int",
          minimum: 0,
          description: "Current XP in this level"
        },
        totalXp: {
          bsonType: "int",
          minimum: 0,
          description: "Total XP earned all time"
        },
        streak: {
          bsonType: "int",
          minimum: 0,
          description: "Current daily streak"
        },
        longestStreak: {
          bsonType: "int",
          minimum: 0
        },
        lastActiveDate: {
          bsonType: "date"
        },
        preferences: {
          bsonType: "object",
          properties: {
            language: { enum: ["vi", "en"] },
            theme: { enum: ["light", "dark", "system"] },
            notifications: { bsonType: "bool" },
            emailNotifications: { bsonType: "bool" },
            dailyGoalMinutes: { bsonType: "int", minimum: 5, maximum: 240 }
          }
        },
        role: {
          enum: ["user", "admin", "moderator"],
          description: "User role"
        },
        status: {
          enum: ["active", "inactive", "banned", "pending"],
          description: "Account status"
        },
        provider: {
          enum: ["local", "google", "facebook"],
          description: "Auth provider"
        },
        providerId: {
          bsonType: "string",
          description: "OAuth provider ID"
        },
        emailVerified: {
          bsonType: "bool"
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

// Users indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ name: "text" })
db.users.createIndex({ totalXp: -1 }) // For leaderboard
db.users.createIndex({ level: -1, xp: -1 })
db.users.createIndex({ createdAt: -1 })
db.users.createIndex({ status: 1 })

// ============================================
// 2. REFRESH TOKENS COLLECTION
// ============================================
db.createCollection("refresh_tokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "token", "expiresAt"],
      properties: {
        userId: { bsonType: "objectId" },
        token: { bsonType: "string" },
        expiresAt: { bsonType: "date" },
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.refresh_tokens.createIndex({ token: 1 }, { unique: true })
db.refresh_tokens.createIndex({ userId: 1 })
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// ============================================
// 3. SKILLS COLLECTION (Static data)
// ============================================
db.createCollection("skills", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["key", "name", "icon"],
      properties: {
        _id: { bsonType: "objectId" },
        key: { enum: ["reading", "listening", "writing", "speaking"] },
        name: { bsonType: "string" },
        nameVi: { bsonType: "string" },
        icon: { bsonType: "string" },
        description: { bsonType: "string" },
        descriptionVi: { bsonType: "string" },
        color: { bsonType: "string" },
        order: { bsonType: "int" }
      }
    }
  }
})

db.skills.createIndex({ key: 1 }, { unique: true })

// ============================================
// 4. LESSONS COLLECTION
// ============================================
db.createCollection("lessons", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "skill", "level", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        title: { bsonType: "string", maxLength: 200 },
        slug: { bsonType: "string" },
        skill: { enum: ["reading", "listening", "writing"] },
        level: { enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
        topic: { bsonType: "string" },
        description: { bsonType: "string", maxLength: 1000 },
        thumbnail: { bsonType: "string" },
        
        // Content based on skill type
        content: {
          bsonType: "object",
          properties: {
            // For Reading
            text: { bsonType: "string" },
            wordCount: { bsonType: "int" },
            
            // For Listening
            audioUrl: { bsonType: "string" },
            transcript: { bsonType: "string" },
            duration: { bsonType: "int" }, // seconds
            accent: { enum: ["american", "british", "australian"] },
            speed: { bsonType: "double" },
            
            // For Writing
            prompt: { bsonType: "string" },
            wordLimit: { bsonType: "object", properties: {
              min: { bsonType: "int" },
              max: { bsonType: "int" }
            }},
            sampleAnswer: { bsonType: "string" },
            
            // Chapters/sections
            chapters: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  id: { bsonType: "string" },
                  label: { bsonType: "string" },
                  time: { bsonType: "string" },
                  startTime: { bsonType: "int" } // seconds
                }
              }
            }
          }
        },
        
        // Questions
        questions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["question", "type"],
            properties: {
              id: { bsonType: "string" },
              question: { bsonType: "string" },
              type: { enum: ["multiple_choice", "fill_blank", "true_false", "matching", "ordering"] },
              options: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  properties: {
                    value: { bsonType: "string" },
                    text: { bsonType: "string" }
                  }
                }
              },
              correctAnswer: { bsonType: ["string", "array"] },
              explanation: { bsonType: "string" },
              points: { bsonType: "int" }
            }
          }
        },
        
        // Vocabulary
        vocabulary: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              word: { bsonType: "string" },
              phonetic: { bsonType: "string" },
              meaning: { bsonType: "string" },
              meaningVi: { bsonType: "string" },
              example: { bsonType: "string" },
              audioUrl: { bsonType: "string" }
            }
          }
        },
        
        // Metadata
        estimatedTime: { bsonType: "int" }, // minutes
        xpReward: { bsonType: "int" },
        totalQuestions: { bsonType: "int" },
        rating: { bsonType: "double" },
        ratingCount: { bsonType: "int" },
        completionCount: { bsonType: "int" },
        
        status: { enum: ["draft", "published", "archived"] },
        featured: { bsonType: "bool" },
        tags: { bsonType: "array", items: { bsonType: "string" } },
        
        createdBy: { bsonType: "objectId" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        publishedAt: { bsonType: "date" }
      }
    }
  }
})

// Lessons indexes
db.lessons.createIndex({ slug: 1 }, { unique: true })
db.lessons.createIndex({ skill: 1, status: 1 })
db.lessons.createIndex({ skill: 1, level: 1 })
db.lessons.createIndex({ topic: 1 })
db.lessons.createIndex({ featured: 1, status: 1 })
db.lessons.createIndex({ rating: -1 })
db.lessons.createIndex({ completionCount: -1 })
db.lessons.createIndex({ title: "text", description: "text" })
db.lessons.createIndex({ tags: 1 })
db.lessons.createIndex({ createdAt: -1 })

// ============================================
// 5. USER LESSON PROGRESS COLLECTION
// ============================================
db.createCollection("user_lesson_progress", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "lessonId"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        lessonId: { bsonType: "objectId" },
        
        status: { enum: ["not_started", "in_progress", "completed"] },
        progress: { bsonType: "int", minimum: 0, maximum: 100 }, // percentage
        
        // Current position (for audio/video)
        currentPosition: { bsonType: "int" }, // seconds
        currentChapter: { bsonType: "string" },
        
        // Answers and scores
        answers: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              questionId: { bsonType: "string" },
              answer: { bsonType: ["string", "array"] },
              isCorrect: { bsonType: "bool" },
              answeredAt: { bsonType: "date" }
            }
          }
        },
        
        // For writing
        submission: {
          bsonType: "object",
          properties: {
            content: { bsonType: "string" },
            wordCount: { bsonType: "int" },
            submittedAt: { bsonType: "date" },
            feedback: { bsonType: "string" },
            score: { bsonType: "int" }
          }
        },
        
        score: { bsonType: "int" },
        maxScore: { bsonType: "int" },
        xpEarned: { bsonType: "int" },
        
        attempts: { bsonType: "int" },
        bestScore: { bsonType: "int" },
        
        timeSpent: { bsonType: "int" }, // seconds
        
        startedAt: { bsonType: "date" },
        completedAt: { bsonType: "date" },
        lastAccessedAt: { bsonType: "date" }
      }
    }
  }
})

// User lesson progress indexes
db.user_lesson_progress.createIndex({ userId: 1, lessonId: 1 }, { unique: true })
db.user_lesson_progress.createIndex({ userId: 1, status: 1 })
db.user_lesson_progress.createIndex({ userId: 1, completedAt: -1 })
db.user_lesson_progress.createIndex({ lessonId: 1, score: -1 }) // For lesson leaderboard

// ============================================
// 6. USER SKILL STATS COLLECTION
// ============================================
db.createCollection("user_skill_stats", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "skill"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        skill: { enum: ["reading", "listening", "writing"] },
        
        // Time stats
        totalTimeSpent: { bsonType: "int" }, // minutes
        weeklyTimeSpent: { bsonType: "int" },
        dailyTimeSpent: { bsonType: "int" },
        
        // Lesson stats
        lessonsCompleted: { bsonType: "int" },
        lessonsInProgress: { bsonType: "int" },
        
        // Score stats
        averageScore: { bsonType: "double" },
        highestScore: { bsonType: "int" },
        
        // XP stats
        totalXpEarned: { bsonType: "int" },
        
        // Level
        skillLevel: { enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
        
        lastActivityAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

db.user_skill_stats.createIndex({ userId: 1, skill: 1 }, { unique: true })
db.user_skill_stats.createIndex({ skill: 1, totalXpEarned: -1 })

// ============================================
// 7. DAILY GOALS COLLECTION
// ============================================
db.createCollection("user_daily_goals", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "date"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        date: { bsonType: "date" }, // Date only (no time)
        
        goals: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              id: { bsonType: "string" },
              type: { enum: ["lessons", "time", "xp", "streak", "custom"] },
              description: { bsonType: "string" },
              target: { bsonType: "int" },
              current: { bsonType: "int" },
              completed: { bsonType: "bool" },
              completedAt: { bsonType: "date" }
            }
          }
        },
        
        allCompleted: { bsonType: "bool" },
        xpBonus: { bsonType: "int" },
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.user_daily_goals.createIndex({ userId: 1, date: -1 })
db.user_daily_goals.createIndex({ date: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL

// ============================================
// 8. ACHIEVEMENTS COLLECTION
// ============================================
db.createCollection("achievements", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["key", "name", "type"],
      properties: {
        _id: { bsonType: "objectId" },
        key: { bsonType: "string" },
        name: { bsonType: "string" },
        nameVi: { bsonType: "string" },
        description: { bsonType: "string" },
        descriptionVi: { bsonType: "string" },
        icon: { bsonType: "string" },
        color: { bsonType: "string" },
        type: { enum: ["streak", "skill", "social", "challenge", "special"] },
        skill: { enum: ["reading", "listening", "writing", "all"] },
        
        // Requirements
        requirement: {
          bsonType: "object",
          properties: {
            type: { bsonType: "string" },
            value: { bsonType: "int" }
          }
        },
        
        xpReward: { bsonType: "int" },
        rarity: { enum: ["common", "uncommon", "rare", "epic", "legendary"] },
        
        order: { bsonType: "int" },
        active: { bsonType: "bool" }
      }
    }
  }
})

db.achievements.createIndex({ key: 1 }, { unique: true })
db.achievements.createIndex({ type: 1, active: 1 })

// ============================================
// 9. USER ACHIEVEMENTS COLLECTION
// ============================================
db.createCollection("user_achievements", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "achievementId"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        achievementId: { bsonType: "objectId" },
        
        unlockedAt: { bsonType: "date" },
        progress: { bsonType: "int" }, // For achievements with progress
        displayed: { bsonType: "bool" } // Show on profile
      }
    }
  }
})

db.user_achievements.createIndex({ userId: 1, achievementId: 1 }, { unique: true })
db.user_achievements.createIndex({ userId: 1, unlockedAt: -1 })

// ============================================
// 10. NOTIFICATIONS COLLECTION
// ============================================
db.createCollection("notifications", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "type"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        type: { 
          enum: ["comment", "like", "follow", "challenge", "achievement", "goal", "system", "friend_request"] 
        },
        
        // Content
        title: { bsonType: "string" },
        message: { bsonType: "string" },
        
        // Related entities
        fromUserId: { bsonType: "objectId" },
        relatedId: { bsonType: "objectId" }, // postId, challengeId, etc.
        relatedType: { enum: ["post", "lesson", "challenge", "achievement", "user"] },
        
        // Status
        read: { bsonType: "bool" },
        readAt: { bsonType: "date" },
        
        // Metadata
        data: { bsonType: "object" }, // Extra data
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 })
db.notifications.createIndex({ userId: 1, createdAt: -1 })
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }) // 30 days TTL

// ============================================
// 11. FRIENDS COLLECTION
// ============================================
db.createCollection("friendships", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "friendId", "status"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        friendId: { bsonType: "objectId" },
        
        status: { enum: ["pending", "accepted", "blocked"] },
        
        requestedBy: { bsonType: "objectId" },
        acceptedAt: { bsonType: "date" },
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.friendships.createIndex({ userId: 1, friendId: 1 }, { unique: true })
db.friendships.createIndex({ userId: 1, status: 1 })
db.friendships.createIndex({ friendId: 1, status: 1 })

// ============================================
// 12. GROUPS COLLECTION
// ============================================
db.createCollection("groups", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name"],
      properties: {
        _id: { bsonType: "objectId" },
        name: { bsonType: "string", maxLength: 100 },
        slug: { bsonType: "string" },
        description: { bsonType: "string", maxLength: 500 },
        icon: { bsonType: "string" },
        coverImage: { bsonType: "string" },
        color: { bsonType: "string" },
        
        type: { enum: ["public", "private", "invite_only"] },
        category: { bsonType: "string" }, // IELTS, Business, etc.
        
        memberCount: { bsonType: "int" },
        postCount: { bsonType: "int" },
        
        rules: { bsonType: "array", items: { bsonType: "string" } },
        
        createdBy: { bsonType: "objectId" },
        admins: { bsonType: "array", items: { bsonType: "objectId" } },
        
        status: { enum: ["active", "archived", "deleted"] },
        
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

db.groups.createIndex({ slug: 1 }, { unique: true })
db.groups.createIndex({ name: "text", description: "text" })
db.groups.createIndex({ memberCount: -1 })
db.groups.createIndex({ category: 1, status: 1 })

// ============================================
// 13. GROUP MEMBERS COLLECTION
// ============================================
db.createCollection("group_members", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["groupId", "userId"],
      properties: {
        _id: { bsonType: "objectId" },
        groupId: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        role: { enum: ["member", "moderator", "admin", "owner"] },
        status: { enum: ["active", "muted", "banned"] },
        
        joinedAt: { bsonType: "date" },
        invitedBy: { bsonType: "objectId" }
      }
    }
  }
})

db.group_members.createIndex({ groupId: 1, userId: 1 }, { unique: true })
db.group_members.createIndex({ userId: 1, status: 1 })

// ============================================
// 14. POSTS COLLECTION (Community Feed)
// ============================================
db.createCollection("posts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["authorId", "content"],
      properties: {
        _id: { bsonType: "objectId" },
        authorId: { bsonType: "objectId" },
        groupId: { bsonType: "objectId" }, // Optional, for group posts
        
        content: { bsonType: "string", maxLength: 5000 },
        
        // Media
        images: { bsonType: "array", items: { bsonType: "string" } },
        video: { bsonType: "string" },
        
        // Engagement
        likeCount: { bsonType: "int" },
        commentCount: { bsonType: "int" },
        shareCount: { bsonType: "int" },
        
        // Related content
        lessonId: { bsonType: "objectId" }, // Share a lesson
        challengeId: { bsonType: "objectId" }, // Share achievement
        
        // Visibility
        visibility: { enum: ["public", "friends", "group", "private"] },
        
        // Moderation
        status: { enum: ["active", "hidden", "deleted", "flagged"] },
        
        tags: { bsonType: "array", items: { bsonType: "string" } },
        mentions: { bsonType: "array", items: { bsonType: "objectId" } },
        
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

db.posts.createIndex({ authorId: 1, createdAt: -1 })
db.posts.createIndex({ groupId: 1, createdAt: -1 })
db.posts.createIndex({ status: 1, createdAt: -1 })
db.posts.createIndex({ content: "text" })
db.posts.createIndex({ tags: 1 })

// ============================================
// 15. POST LIKES COLLECTION
// ============================================
db.createCollection("post_likes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["postId", "userId"],
      properties: {
        _id: { bsonType: "objectId" },
        postId: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.post_likes.createIndex({ postId: 1, userId: 1 }, { unique: true })

// ============================================
// 16. COMMENTS COLLECTION
// ============================================
db.createCollection("comments", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["postId", "authorId", "content"],
      properties: {
        _id: { bsonType: "objectId" },
        postId: { bsonType: "objectId" },
        authorId: { bsonType: "objectId" },
        parentId: { bsonType: "objectId" }, // For nested replies
        
        content: { bsonType: "string", maxLength: 1000 },
        
        likeCount: { bsonType: "int" },
        replyCount: { bsonType: "int" },
        
        status: { enum: ["active", "deleted", "flagged"] },
        
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

db.comments.createIndex({ postId: 1, createdAt: 1 })
db.comments.createIndex({ parentId: 1 })
db.comments.createIndex({ authorId: 1 })

// ============================================
// 17. CHALLENGES COLLECTION
// ============================================
db.createCollection("challenges", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "type", "startDate", "endDate"],
      properties: {
        _id: { bsonType: "objectId" },
        title: { bsonType: "string" },
        titleVi: { bsonType: "string" },
        description: { bsonType: "string" },
        descriptionVi: { bsonType: "string" },
        
        type: { enum: ["daily", "weekly", "monthly", "special"] },
        skill: { enum: ["reading", "listening", "writing", "all"] },
        
        // Requirements
        requirement: {
          bsonType: "object",
          properties: {
            type: { enum: ["lessons", "time", "score", "streak"] },
            target: { bsonType: "int" }
          }
        },
        
        // Rewards
        xpReward: { bsonType: "int" },
        badge: { bsonType: "string" },
        
        // Time
        startDate: { bsonType: "date" },
        endDate: { bsonType: "date" },
        
        // Stats
        participantCount: { bsonType: "int" },
        completedCount: { bsonType: "int" },
        
        icon: { bsonType: "string" },
        color: { bsonType: "string" },
        
        status: { enum: ["upcoming", "active", "ended"] },
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.challenges.createIndex({ status: 1, endDate: 1 })
db.challenges.createIndex({ type: 1, status: 1 })
db.challenges.createIndex({ startDate: 1, endDate: 1 })

// ============================================
// 18. CHALLENGE PARTICIPANTS COLLECTION
// ============================================
db.createCollection("challenge_participants", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["challengeId", "userId"],
      properties: {
        _id: { bsonType: "objectId" },
        challengeId: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        progress: { bsonType: "int" },
        target: { bsonType: "int" },
        completed: { bsonType: "bool" },
        
        rank: { bsonType: "int" },
        xpEarned: { bsonType: "int" },
        
        joinedAt: { bsonType: "date" },
        completedAt: { bsonType: "date" }
      }
    }
  }
})

db.challenge_participants.createIndex({ challengeId: 1, userId: 1 }, { unique: true })
db.challenge_participants.createIndex({ challengeId: 1, progress: -1 }) // Leaderboard
db.challenge_participants.createIndex({ userId: 1, completed: 1 })

// ============================================
// 19. GAMES COLLECTION
// ============================================
db.createCollection("games", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["key", "title", "type"],
      properties: {
        _id: { bsonType: "objectId" },
        key: { bsonType: "string" },
        title: { bsonType: "string" },
        titleVi: { bsonType: "string" },
        description: { bsonType: "string" },
        descriptionVi: { bsonType: "string" },
        
        type: { enum: ["vocabulary", "grammar", "mixed", "quiz"] },
        difficulty: { enum: ["easy", "medium", "hard"] },
        
        icon: { bsonType: "string" },
        color: { bsonType: "string" },
        bgColor: { bsonType: "string" },
        
        // Stats
        playCount: { bsonType: "int" },
        currentPlaying: { bsonType: "int" },
        rating: { bsonType: "double" },
        ratingCount: { bsonType: "int" },
        
        // Configuration
        config: {
          bsonType: "object",
          properties: {
            timeLimit: { bsonType: "int" },
            questionsPerRound: { bsonType: "int" },
            xpPerCorrect: { bsonType: "int" },
            streakBonus: { bsonType: "bool" }
          }
        },
        
        status: { enum: ["active", "maintenance", "disabled"] },
        featured: { bsonType: "bool" },
        
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  }
})

db.games.createIndex({ key: 1 }, { unique: true })
db.games.createIndex({ type: 1, status: 1 })
db.games.createIndex({ featured: 1, status: 1 })

// ============================================
// 20. GAME SESSIONS COLLECTION
// ============================================
db.createCollection("game_sessions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["gameId", "userId"],
      properties: {
        _id: { bsonType: "objectId" },
        gameId: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        score: { bsonType: "int" },
        correctAnswers: { bsonType: "int" },
        totalQuestions: { bsonType: "int" },
        streak: { bsonType: "int" },
        
        xpEarned: { bsonType: "int" },
        duration: { bsonType: "int" }, // seconds
        
        answers: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              questionId: { bsonType: "string" },
              answer: { bsonType: "string" },
              isCorrect: { bsonType: "bool" },
              timeSpent: { bsonType: "int" }
            }
          }
        },
        
        startedAt: { bsonType: "date" },
        endedAt: { bsonType: "date" }
      }
    }
  }
})

db.game_sessions.createIndex({ gameId: 1, userId: 1, startedAt: -1 })
db.game_sessions.createIndex({ gameId: 1, score: -1 }) // Leaderboard
db.game_sessions.createIndex({ userId: 1, startedAt: -1 })

// ============================================
// 21. CHATBOT CONVERSATIONS COLLECTION
// ============================================
db.createCollection("chatbot_conversations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        title: { bsonType: "string" },
        preview: { bsonType: "string" },
        
        // Context
        lessonId: { bsonType: "objectId" },
        skill: { enum: ["reading", "listening", "writing", "general"] },
        
        messageCount: { bsonType: "int" },
        
        lastMessageAt: { bsonType: "date" },
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.chatbot_conversations.createIndex({ userId: 1, lastMessageAt: -1 })

// ============================================
// 22. CHATBOT MESSAGES COLLECTION
// ============================================
db.createCollection("chatbot_messages", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["conversationId", "role", "content"],
      properties: {
        _id: { bsonType: "objectId" },
        conversationId: { bsonType: "objectId" },
        
        role: { enum: ["user", "assistant", "system"] },
        content: { bsonType: "string" },
        
        // For AI responses with structured data
        data: {
          bsonType: "object",
          properties: {
            vocabulary: { bsonType: "object" },
            grammar: { bsonType: "object" },
            suggestions: { bsonType: "array" }
          }
        },
        
        // Quick actions
        actions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              label: { bsonType: "string" },
              icon: { bsonType: "string" },
              action: { bsonType: "string" }
            }
          }
        },
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.chatbot_messages.createIndex({ conversationId: 1, createdAt: 1 })

// ============================================
// 23. LEADERBOARD SNAPSHOTS COLLECTION
// ============================================
db.createCollection("leaderboard_snapshots", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "period"],
      properties: {
        _id: { bsonType: "objectId" },
        type: { enum: ["weekly", "monthly", "all_time"] },
        period: { bsonType: "string" }, // e.g., "2024-W48", "2024-11"
        
        entries: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              rank: { bsonType: "int" },
              userId: { bsonType: "objectId" },
              name: { bsonType: "string" },
              avatar: { bsonType: "string" },
              xp: { bsonType: "int" },
              level: { bsonType: "int" }
            }
          }
        },
        
        generatedAt: { bsonType: "date" }
      }
    }
  }
})

db.leaderboard_snapshots.createIndex({ type: 1, period: 1 }, { unique: true })

// ============================================
// 24. ACTIVITY LOGS COLLECTION
// ============================================
db.createCollection("activity_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "action"],
      properties: {
        _id: { bsonType: "objectId" },
        userId: { bsonType: "objectId" },
        
        action: { 
          enum: [
            "login", "logout", "lesson_start", "lesson_complete", 
            "game_play", "challenge_join", "achievement_unlock",
            "post_create", "comment_create", "friend_add"
          ] 
        },
        
        // Related entity
        entityType: { bsonType: "string" },
        entityId: { bsonType: "objectId" },
        
        // Additional data
        metadata: { bsonType: "object" },
        
        // XP changes
        xpChange: { bsonType: "int" },
        
        // Client info
        ip: { bsonType: "string" },
        userAgent: { bsonType: "string" },
        
        createdAt: { bsonType: "date" }
      }
    }
  }
})

db.activity_logs.createIndex({ userId: 1, createdAt: -1 })
db.activity_logs.createIndex({ action: 1, createdAt: -1 })
db.activity_logs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }) // 90 days TTL

// ============================================
// Print summary
// ============================================
print("\n========================================")
print("EngSocial Database Schema Created!")
print("========================================")
print("Collections created: 24")
print("")
print("Next steps:")
print("  1. Run seed data: mongosh <MONGODB_URI> < database/seed-data.js")
print("  2. Configure .env with MONGODB_URI")
print("  3. npm run dev")
print("========================================\n")
