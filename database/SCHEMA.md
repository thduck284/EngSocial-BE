# EngSocial Database Schema Documentation

## Table of Contents

1. [Overview](#overview)
2. [Auth Module](#auth-module)
   - [users](#users)
   - [refresh_tokens](#refresh_tokens)
3. [Learning Module](#learning-module)
   - [skills](#skills)
   - [lessons](#lessons)
   - [user_lesson_progress](#user_lesson_progress)
   - [user_skill_stats](#user_skill_stats)
   - [user_daily_goals](#user_daily_goals)
4. [Gamification Module](#gamification-module)
   - [achievements](#achievements)
   - [user_achievements](#user_achievements)
   - [challenges](#challenges)
   - [challenge_participants](#challenge_participants)
   - [games](#games)
   - [game_sessions](#game_sessions)
   - [leaderboard_snapshots](#leaderboard_snapshots)
5. [Social Module](#social-module)
   - [friendships](#friendships)
   - [groups](#groups)
   - [group_members](#group_members)
   - [posts](#posts)
   - [post_likes](#post_likes)
   - [comments](#comments)
6. [System Module](#system-module)
   - [notifications](#notifications)
   - [activity_logs](#activity_logs)
   - [chatbot_conversations](#chatbot_conversations)
   - [chatbot_messages](#chatbot_messages)
7. [Entity Relationship Diagram](#entity-relationship-diagram)

---

## Overview

| Module | Collections | Description |
|--------|-------------|-------------|
| Auth | 2 | User accounts & authentication tokens |
| Learning | 5 | Skills, lessons, progress tracking |
| Gamification | 7 | Achievements, challenges, games, leaderboards |
| Social | 6 | Friends, groups, posts, comments |
| System | 4 | Notifications, activity logs, chatbot |
| **Total** | **24** | |

---

## Auth Module

### users

Stores user account information and profile data.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `email` | String | Yes | - | Unique, lowercase, email format |
| `password` | String | Yes | - | Min 8 chars, not returned by default |
| `name` | String | Yes | - | 2-100 chars |
| `avatar` | String | No | - | Avatar image URL |
| `bio` | String | No | - | Max 500 chars |
| `level` | Number | No | 1 | 1-100 |
| `xp` | Number | No | 0 | Current level XP |
| `totalXp` | Number | No | 0 | Lifetime XP |
| `streak` | Number | No | 0 | Current streak days |
| `longestStreak` | Number | No | 0 | Best streak record |
| `lastActiveDate` | Date | No | - | Last activity timestamp |
| `preferences.language` | String | No | `vi` | `vi`, `en` |
| `preferences.theme` | String | No | `system` | `light`, `dark`, `system` |
| `preferences.notifications` | Boolean | No | true | Push notifications |
| `preferences.emailNotifications` | Boolean | No | true | Email notifications |
| `preferences.dailyGoalMinutes` | Number | No | 30 | 5-240 minutes |
| `role` | String | No | `user` | `user`, `admin`, `moderator` |
| `status` | String | No | `pending` | `active`, `inactive`, `banned`, `pending` |
| `provider` | String | No | `local` | `local`, `google`, `facebook` |
| `providerId` | String | No | - | OAuth provider ID |
| `emailVerified` | Boolean | No | false | Email verification status |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `email` (unique)
- `name` (text search)
- `totalXp` (descending)
- `level, xp` (descending)
- `status`

---

### refresh_tokens

Stores JWT refresh tokens for authentication.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `token` | String | Yes | - | Unique refresh token |
| `expiresAt` | Date | Yes | - | TTL - auto delete when expired |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId`
- `expiresAt` (TTL index)

---

## Learning Module

### skills

Defines available learning skills.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `key` | String | Yes | - | `reading`, `listening`, `writing`, `speaking` |
| `name` | String | Yes | - | English name |
| `nameVi` | String | No | - | Vietnamese name |
| `icon` | String | Yes | - | Icon identifier |
| `description` | String | No | - | English description |
| `descriptionVi` | String | No | - | Vietnamese description |
| `color` | String | No | - | Theme color |
| `order` | Number | No | 0 | Display order |

**Indexes:**
- `key` (unique)

---

### lessons

Stores all lesson content.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `title` | String | Yes | - | Max 200 chars |
| `slug` | String | Yes | - | URL-friendly unique identifier |
| `skill` | String | Yes | - | `reading`, `listening`, `writing` |
| `level` | String | Yes | - | `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `topic` | String | No | - | Topic category |
| `description` | String | No | - | Max 1000 chars |
| `thumbnail` | String | No | - | Thumbnail image URL |
| `content` | Object | No | - | Skill-specific content (see below) |
| `questions` | Array | No | [] | Array of Question objects |
| `vocabulary` | Array | No | [] | Array of Vocabulary objects |
| `estimatedTime` | Number | No | - | Minutes |
| `xpReward` | Number | No | 50 | XP for completion |
| `totalQuestions` | Number | No | 0 | Question count |
| `rating` | Number | No | 0 | Average rating |
| `ratingCount` | Number | No | 0 | Number of ratings |
| `completionCount` | Number | No | 0 | Times completed |
| `status` | String | No | `draft` | `draft`, `published`, `archived` |
| `featured` | Boolean | No | false | Featured lesson |
| `tags` | Array | No | [] | Tag strings |
| `createdBy` | ObjectId | No | - | Reference to `users` |
| `publishedAt` | Date | No | - | Publish date |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Content Object (by skill):**

| Skill | Fields |
|-------|--------|
| Reading | `text`, `wordCount` |
| Listening | `audioUrl`, `transcript`, `duration`, `accent`, `speed`, `chapters[]` |
| Writing | `prompt`, `wordLimit.min`, `wordLimit.max`, `sampleAnswer` |

**Question Object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Question identifier |
| `question` | String | Question text (required) |
| `type` | String | `multiple_choice`, `fill_blank`, `true_false`, `matching`, `ordering` |
| `options` | Array | `[{ value, text }]` |
| `correctAnswer` | Mixed | String or Array |
| `explanation` | String | Answer explanation |
| `points` | Number | Points (default: 10) |

**Vocabulary Object:**

| Field | Type | Description |
|-------|------|-------------|
| `word` | String | Word |
| `phonetic` | String | Phonetic spelling |
| `meaning` | String | English meaning |
| `meaningVi` | String | Vietnamese meaning |
| `example` | String | Example sentence |
| `audioUrl` | String | Pronunciation audio |

**Chapter Object (Listening):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Chapter identifier |
| `label` | String | Chapter label |
| `time` | String | Display time (e.g., "0:30") |
| `startTime` | Number | Start time in seconds |

**Indexes:**
- `slug` (unique)
- `skill, status`
- `skill, level`
- `topic`
- `featured, status`
- `rating` (descending)
- `completionCount` (descending)
- `title, description` (text search)
- `tags`

---

### user_lesson_progress

Tracks user progress on each lesson.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `lessonId` | ObjectId | Yes | - | Reference to `lessons` |
| `status` | String | No | `not_started` | `not_started`, `in_progress`, `completed` |
| `progress` | Number | No | 0 | 0-100 percent |
| `currentPosition` | Number | No | - | Audio/video position (seconds) |
| `currentChapter` | String | No | - | Current chapter ID |
| `answers` | Array | No | [] | Array of Answer objects |
| `submission` | Object | No | - | Writing submission (see below) |
| `score` | Number | No | 0 | Latest score |
| `maxScore` | Number | No | - | Maximum possible score |
| `xpEarned` | Number | No | 0 | XP earned |
| `attempts` | Number | No | 0 | Attempt count |
| `bestScore` | Number | No | 0 | Best score achieved |
| `timeSpent` | Number | No | 0 | Seconds |
| `startedAt` | Date | No | - | First start time |
| `completedAt` | Date | No | - | Completion time |
| `lastAccessedAt` | Date | No | - | Last access time |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Answer Object:**

| Field | Type | Description |
|-------|------|-------------|
| `questionId` | String | Question ID |
| `answer` | Mixed | User's answer |
| `isCorrect` | Boolean | Correctness |
| `answeredAt` | Date | Answer timestamp |

**Submission Object (Writing):**

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Written content |
| `wordCount` | Number | Word count |
| `submittedAt` | Date | Submission time |
| `feedback` | String | AI/teacher feedback |
| `score` | Number | Writing score |

**Indexes:**
- `userId, lessonId` (unique compound)
- `userId, status`
- `lessonId, score` (descending)

---

### user_skill_stats

Aggregated statistics per user per skill.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `skill` | String | Yes | - | `reading`, `listening`, `writing` |
| `totalTimeSpent` | Number | No | 0 | Total minutes |
| `weeklyTimeSpent` | Number | No | 0 | This week minutes |
| `dailyTimeSpent` | Number | No | 0 | Today minutes |
| `lessonsCompleted` | Number | No | 0 | Completed count |
| `lessonsInProgress` | Number | No | 0 | In progress count |
| `averageScore` | Number | No | 0 | Average score |
| `highestScore` | Number | No | 0 | Best score |
| `totalXpEarned` | Number | No | 0 | XP from this skill |
| `skillLevel` | String | No | `A1` | `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `lastActivityAt` | Date | No | - | Last activity |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId, skill` (unique compound)
- `skill, totalXpEarned` (descending)

---

### user_daily_goals

Daily learning goals (auto-deleted after 90 days).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `date` | Date | Yes | - | Goal date |
| `goals` | Array | No | [] | Array of Goal objects |
| `allCompleted` | Boolean | No | false | All goals completed |
| `xpBonus` | Number | No | 0 | Bonus XP earned |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Goal Object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Goal identifier |
| `type` | String | `lessons`, `time`, `xp`, `streak`, `custom` |
| `description` | String | Goal description |
| `target` | Number | Target value |
| `current` | Number | Current progress (default: 0) |
| `completed` | Boolean | Completion status (default: false) |
| `completedAt` | Date | Completion timestamp |

**Indexes:**
- `userId, date` (descending)
- `date` (TTL: 90 days)

---

## Gamification Module

### achievements

Achievement definitions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `key` | String | Yes | - | Unique identifier |
| `name` | String | Yes | - | English name |
| `nameVi` | String | No | - | Vietnamese name |
| `description` | String | No | - | English description |
| `descriptionVi` | String | No | - | Vietnamese description |
| `icon` | String | No | - | Icon identifier |
| `color` | String | No | - | Theme color |
| `type` | String | Yes | - | `streak`, `skill`, `social`, `challenge`, `special` |
| `skill` | String | No | - | `reading`, `listening`, `writing`, `all` |
| `requirement.type` | String | No | - | Requirement type |
| `requirement.value` | Number | No | - | Required value |
| `xpReward` | Number | No | 0 | XP reward |
| `rarity` | String | No | `common` | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `order` | Number | No | 0 | Display order |
| `active` | Boolean | No | true | Is active |

**Indexes:**
- `key` (unique)
- `type, active`

---

### user_achievements

Tracks user unlocked achievements.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `achievementId` | ObjectId | Yes | - | Reference to `achievements` |
| `unlockedAt` | Date | No | Now | Unlock timestamp |
| `progress` | Number | No | 0 | Progress toward achievement |
| `displayed` | Boolean | No | false | Shown on profile |

**Indexes:**
- `userId, achievementId` (unique compound)
- `userId, unlockedAt` (descending)

---

### challenges

Challenge definitions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `title` | String | Yes | - | English title |
| `titleVi` | String | No | - | Vietnamese title |
| `description` | String | No | - | English description |
| `descriptionVi` | String | No | - | Vietnamese description |
| `type` | String | Yes | - | `daily`, `weekly`, `monthly`, `special` |
| `skill` | String | No | - | `reading`, `listening`, `writing`, `all` |
| `requirement.type` | String | No | - | `lessons`, `time`, `score`, `streak` |
| `requirement.target` | Number | No | - | Target value |
| `xpReward` | Number | No | 0 | XP reward |
| `badge` | String | No | - | Badge image URL |
| `startDate` | Date | Yes | - | Start date |
| `endDate` | Date | Yes | - | End date |
| `participantCount` | Number | No | 0 | Participant count |
| `completedCount` | Number | No | 0 | Completed count |
| `icon` | String | No | - | Icon identifier |
| `color` | String | No | - | Theme color |
| `status` | String | No | `upcoming` | `upcoming`, `active`, `ended` |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `status, endDate`
- `type, status`
- `startDate, endDate`

---

### challenge_participants

Tracks user participation in challenges.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `challengeId` | ObjectId | Yes | - | Reference to `challenges` |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `progress` | Number | No | 0 | Current progress |
| `target` | Number | No | - | Personal target |
| `completed` | Boolean | No | false | Completion status |
| `rank` | Number | No | - | Current rank |
| `xpEarned` | Number | No | 0 | XP earned |
| `joinedAt` | Date | No | Now | Join timestamp |
| `completedAt` | Date | No | - | Completion timestamp |

**Indexes:**
- `challengeId, userId` (unique compound)
- `challengeId, progress` (descending)
- `userId, completed`

---

### games

Mini game definitions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `key` | String | Yes | - | Unique identifier |
| `title` | String | Yes | - | English title |
| `titleVi` | String | No | - | Vietnamese title |
| `description` | String | No | - | English description |
| `descriptionVi` | String | No | - | Vietnamese description |
| `type` | String | Yes | - | `vocabulary`, `grammar`, `mixed`, `quiz` |
| `difficulty` | String | No | `medium` | `easy`, `medium`, `hard` |
| `icon` | String | No | - | Icon identifier |
| `color` | String | No | - | Theme color |
| `bgColor` | String | No | - | Background color |
| `playCount` | Number | No | 0 | Total plays |
| `currentPlaying` | Number | No | 0 | Currently playing |
| `rating` | Number | No | 0 | Average rating |
| `ratingCount` | Number | No | 0 | Rating count |
| `config.timeLimit` | Number | No | - | Time limit (seconds) |
| `config.questionsPerRound` | Number | No | - | Questions per round |
| `config.xpPerCorrect` | Number | No | - | XP per correct answer |
| `config.streakBonus` | Boolean | No | - | Streak bonus enabled |
| `status` | String | No | `active` | `active`, `maintenance`, `disabled` |
| `featured` | Boolean | No | false | Featured game |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `key` (unique)
- `type, status`
- `featured, status`

---

### game_sessions

Game play history.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `gameId` | ObjectId | Yes | - | Reference to `games` |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `score` | Number | No | 0 | Final score |
| `correctAnswers` | Number | No | 0 | Correct count |
| `totalQuestions` | Number | No | - | Total questions |
| `streak` | Number | No | 0 | Best streak |
| `xpEarned` | Number | No | 0 | XP earned |
| `duration` | Number | No | - | Duration (seconds) |
| `answers` | Array | No | [] | Array of GameAnswer objects |
| `startedAt` | Date | No | Now | Start time |
| `endedAt` | Date | No | - | End time |

**GameAnswer Object:**

| Field | Type | Description |
|-------|------|-------------|
| `questionId` | String | Question ID |
| `answer` | String | User's answer |
| `isCorrect` | Boolean | Correctness |
| `timeSpent` | Number | Time spent (ms) |

**Indexes:**
- `gameId, userId, startedAt` (descending)
- `gameId, score` (descending)
- `userId, startedAt` (descending)

---

### leaderboard_snapshots

Periodic leaderboard snapshots.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `type` | String | Yes | - | `weekly`, `monthly`, `all_time` |
| `period` | String | Yes | - | e.g., "2024-W48", "2024-11" |
| `entries` | Array | No | [] | Array of Entry objects |
| `generatedAt` | Date | No | Now | Generation timestamp |

**Entry Object:**

| Field | Type | Description |
|-------|------|-------------|
| `rank` | Number | Position |
| `userId` | ObjectId | Reference to `users` |
| `name` | String | User name |
| `avatar` | String | User avatar |
| `xp` | Number | XP amount |
| `level` | Number | User level |

**Indexes:**
- `type, period` (unique compound)

---

## Social Module

### friendships

Friend relationships between users.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `friendId` | ObjectId | Yes | - | Reference to `users` |
| `status` | String | No | `pending` | `pending`, `accepted`, `blocked` |
| `requestedBy` | ObjectId | No | - | Who sent the request |
| `acceptedAt` | Date | No | - | Acceptance timestamp |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId, friendId` (unique compound)
- `userId, status`
- `friendId, status`

---

### groups

Study group definitions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `name` | String | Yes | - | Max 100 chars |
| `slug` | String | Yes | - | URL-friendly unique identifier |
| `description` | String | No | - | Max 500 chars |
| `icon` | String | No | - | Group icon |
| `coverImage` | String | No | - | Cover image URL |
| `color` | String | No | - | Theme color |
| `type` | String | No | `public` | `public`, `private`, `invite_only` |
| `category` | String | No | - | Group category |
| `memberCount` | Number | No | 0 | Member count |
| `postCount` | Number | No | 0 | Post count |
| `rules` | Array | No | [] | Group rules |
| `createdBy` | ObjectId | No | - | Reference to `users` |
| `admins` | Array | No | [] | Admin user IDs |
| `status` | String | No | `active` | `active`, `archived`, `deleted` |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `slug` (unique)
- `name, description` (text search)
- `memberCount` (descending)
- `category, status`

---

### group_members

Group membership.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `groupId` | ObjectId | Yes | - | Reference to `groups` |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `role` | String | No | `member` | `member`, `moderator`, `admin`, `owner` |
| `status` | String | No | `active` | `active`, `muted`, `banned` |
| `joinedAt` | Date | No | Now | Join timestamp |
| `invitedBy` | ObjectId | No | - | Who invited |

**Indexes:**
- `groupId, userId` (unique compound)
- `userId, status`

---

### posts

Community posts.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `authorId` | ObjectId | Yes | - | Reference to `users` |
| `groupId` | ObjectId | No | - | Reference to `groups` |
| `content` | String | Yes | - | Max 5000 chars |
| `images` | Array | No | [] | Image URLs |
| `video` | String | No | - | Video URL |
| `likeCount` | Number | No | 0 | Like count |
| `commentCount` | Number | No | 0 | Comment count |
| `shareCount` | Number | No | 0 | Share count |
| `lessonId` | ObjectId | No | - | Related lesson |
| `challengeId` | ObjectId | No | - | Related challenge |
| `visibility` | String | No | `public` | `public`, `friends`, `group`, `private` |
| `status` | String | No | `active` | `active`, `hidden`, `deleted`, `flagged` |
| `tags` | Array | No | [] | Tag strings |
| `mentions` | Array | No | [] | Mentioned user IDs |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `authorId, createdAt` (descending)
- `groupId, createdAt` (descending)
- `status, createdAt` (descending)
- `content` (text search)
- `tags`

---

### post_likes

Post likes.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `postId` | ObjectId | Yes | - | Reference to `posts` |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `postId, userId` (unique compound)

---

### comments

Post comments (supports nested replies).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `postId` | ObjectId | Yes | - | Reference to `posts` |
| `authorId` | ObjectId | Yes | - | Reference to `users` |
| `parentId` | ObjectId | No | - | Parent comment (for replies) |
| `content` | String | Yes | - | Max 1000 chars |
| `likeCount` | Number | No | 0 | Like count |
| `replyCount` | Number | No | 0 | Reply count |
| `status` | String | No | `active` | `active`, `deleted`, `flagged` |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `postId, createdAt`
- `parentId`
- `authorId`

---

## System Module

### notifications

User notifications (auto-deleted after 30 days).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `type` | String | Yes | - | `comment`, `like`, `follow`, `challenge`, `achievement`, `goal`, `system`, `friend_request` |
| `title` | String | No | - | Notification title |
| `message` | String | No | - | Notification message |
| `fromUserId` | ObjectId | No | - | Source user |
| `relatedId` | ObjectId | No | - | Related entity ID |
| `relatedType` | String | No | - | `post`, `lesson`, `challenge`, `achievement`, `user` |
| `read` | Boolean | No | false | Read status |
| `readAt` | Date | No | - | Read timestamp |
| `data` | Mixed | No | - | Additional data |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId, read, createdAt` (descending)
- `createdAt` (TTL: 30 days)

---

### activity_logs

User activity tracking (auto-deleted after 90 days).

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `action` | String | Yes | - | `login`, `logout`, `lesson_start`, `lesson_complete`, `game_play`, `challenge_join`, `achievement_unlock`, `post_create`, `comment_create`, `friend_add` |
| `entityType` | String | No | - | Related entity type |
| `entityId` | ObjectId | No | - | Related entity ID |
| `metadata` | Mixed | No | - | Additional metadata |
| `xpChange` | Number | No | - | XP change amount |
| `ip` | String | No | - | Client IP address |
| `userAgent` | String | No | - | Browser user agent |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId, createdAt` (descending)
- `action, createdAt` (descending)
- `createdAt` (TTL: 90 days)

---

### chatbot_conversations

AI chatbot conversation sessions.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `userId` | ObjectId | Yes | - | Reference to `users` |
| `title` | String | No | - | Conversation title |
| `preview` | String | No | - | Preview text |
| `lessonId` | ObjectId | No | - | Related lesson |
| `skill` | String | No | `general` | `reading`, `listening`, `writing`, `general` |
| `messageCount` | Number | No | 0 | Message count |
| `lastMessageAt` | Date | No | - | Last message time |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Indexes:**
- `userId, lastMessageAt` (descending)

---

### chatbot_messages

Individual chat messages.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `_id` | ObjectId | Yes | Auto | Primary key |
| `conversationId` | ObjectId | Yes | - | Reference to `chatbot_conversations` |
| `role` | String | Yes | - | `user`, `assistant`, `system` |
| `content` | String | Yes | - | Message content |
| `data.vocabulary` | Mixed | No | - | Vocabulary data |
| `data.grammar` | Mixed | No | - | Grammar data |
| `data.suggestions` | Array | No | [] | Suggestion strings |
| `actions` | Array | No | [] | Array of Action objects |
| `createdAt` | Date | Auto | - | Timestamp |
| `updatedAt` | Date | Auto | - | Timestamp |

**Action Object:**

| Field | Type | Description |
|-------|------|-------------|
| `label` | String | Button label |
| `icon` | String | Icon identifier |
| `action` | String | Action identifier |

**Indexes:**
- `conversationId, createdAt`

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTH MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐         ┌────────────────┐                                     │
│  │  users  │◄────────│ refresh_tokens │                                     │
│  └────┬────┘         └────────────────┘                                     │
│       │                                                                      │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LEARNING MODULE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────┐     ┌─────────┐     ┌──────────────────────┐                    │
│  │ skills │     │ lessons │◄────│ user_lesson_progress │                    │
│  └────────┘     └────┬────┘     └──────────────────────┘                    │
│                      │                     ▲                                 │
│                      │                     │                                 │
│                      │          ┌──────────┴───────────┐                    │
│                      │          │   user_skill_stats   │                    │
│                      │          └──────────────────────┘                    │
│                      │                     ▲                                 │
│                      │                     │                                 │
│                      │          ┌──────────┴───────────┐                    │
│                      │          │   user_daily_goals   │                    │
│                      │          └──────────────────────┘                    │
└──────────────────────┼──────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GAMIFICATION MODULE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌───────────────────┐                                 │
│  │ achievements │◄────│ user_achievements │                                 │
│  └──────────────┘     └───────────────────┘                                 │
│                                                                              │
│  ┌────────────┐     ┌────────────────────────┐                              │
│  │ challenges │◄────│ challenge_participants │                              │
│  └────────────┘     └────────────────────────┘                              │
│                                                                              │
│  ┌───────┐          ┌───────────────┐                                       │
│  │ games │◄─────────│ game_sessions │                                       │
│  └───────┘          └───────────────┘                                       │
│                                                                              │
│  ┌───────────────────────┐                                                  │
│  │ leaderboard_snapshots │                                                  │
│  └───────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            SOCIAL MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                                            │
│  │ friendships │ (users ◄──► users)                                         │
│  └─────────────┘                                                            │
│                                                                              │
│  ┌────────┐     ┌───────────────┐                                           │
│  │ groups │◄────│ group_members │                                           │
│  └───┬────┘     └───────────────┘                                           │
│      │                                                                       │
│      ▼                                                                       │
│  ┌───────┐      ┌────────────┐     ┌──────────┐                             │
│  │ posts │◄─────│ post_likes │     │ comments │                             │
│  └───┬───┘      └────────────┘     └────┬─────┘                             │
│      │                                   │                                   │
│      └───────────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            SYSTEM MODULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐     ┌───────────────┐                                    │
│  │ notifications │     │ activity_logs │                                    │
│  └───────────────┘     └───────────────┘                                    │
│                                                                              │
│  ┌────────────────────────┐     ┌──────────────────┐                        │
│  │ chatbot_conversations  │◄────│ chatbot_messages │                        │
│  └────────────────────────┘     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Notes

### TTL (Time-To-Live) Collections

| Collection | TTL | Description |
|------------|-----|-------------|
| `refresh_tokens` | Dynamic | Based on `expiresAt` field |
| `notifications` | 30 days | Auto-cleanup old notifications |
| `activity_logs` | 90 days | Auto-cleanup old logs |
| `user_daily_goals` | 90 days | Auto-cleanup old goals |

### Text Search Enabled

- `users.name`
- `lessons.title, lessons.description`
- `groups.name, groups.description`
- `posts.content`

### Unique Constraints

- `users.email`
- `skills.key`
- `lessons.slug`
- `groups.slug`
- `achievements.key`
- `games.key`
- `user_lesson_progress: (userId, lessonId)`
- `user_skill_stats: (userId, skill)`
- `friendships: (userId, friendId)`
- `group_members: (groupId, userId)`
- `post_likes: (postId, userId)`
- `user_achievements: (userId, achievementId)`
- `challenge_participants: (challengeId, userId)`
- `leaderboard_snapshots: (type, period)`
