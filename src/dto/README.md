# DTO (Data Transfer Object) Structure

## Overview

DTOs được tổ chức theo **request** (input) và **response** (output), trong từng module tương ứng models.

```
dto/
├── base.dto.js           # Base DTO class
├── response.dto.js       # API Response helpers (sendSuccess, sendError)
├── auth/
│   ├── request/          # Request DTOs (input)
│   │   ├── auth.request.js   # RegisterRequestDTO, LoginRequestDTO, ...
│   │   └── index.js
│   ├── response/         # Response DTOs (output)
│   │   ├── user.response.js     # UserDTO, UserProfileDTO
│   │   ├── auth.response.js     # AuthResponseDTO, RefreshTokenResponseDTO
│   │   └── index.js
│   └── index.js
├── learning/
│   ├── request/
│   ├── response/
│   │   ├── lesson.response.js
│   │   └── index.js
│   └── index.js
├── gamification/
│   ├── request/
│   ├── response/
│   │   ├── achievement.response.js
│   │   └── index.js
│   └── index.js
├── social/
│   ├── request/
│   ├── response/
│   │   ├── post.response.js
│   │   └── index.js
│   └── index.js
├── system/
│   ├── request/
│   ├── response/
│   │   ├── notification.response.js
│   │   └── index.js
│   └── index.js
└── index.js
```

## Request vs Response

| Loại | Mục đích | Ví dụ |
|------|----------|--------|
| **Request DTO** | Định nghĩa & chuẩn hóa dữ liệu **đầu vào** (body, query) | `RegisterRequestDTO`, `LoginRequestDTO` |
| **Response DTO** | Định nghĩa dữ liệu **trả về** cho client (ẩn field nhạy cảm) | `UserDTO`, `AuthResponseDTO` |

## Auth Module

### Request DTOs
- `RegisterRequestDTO` - email, password, name (normalize trim, lowercase email)
- `LoginRequestDTO` - email, password
- `RefreshTokenRequestDTO` - refreshToken
- `ChangePasswordRequestDTO`, `ForgotPasswordRequestDTO`, `ResetPasswordRequestDTO`

### Response DTOs
- `UserDTO` - Full user information
- `UserProfileDTO` - Minimal user info (cards/lists)
- `AuthResponseDTO` / `LoginResponseDTO` / `RegisterResponseDTO` - user + tokens
- `RefreshTokenResponseDTO` - accessToken only

## Learning Module
- **Response:** `SkillDTO`, `LessonDTO`, `LessonDetailDTO`, `UserLessonProgressDTO`, `UserSkillStatsDTO`, `UserDailyGoalDTO`
- **Request:** Thêm khi cần (e.g. `CreateLessonRequestDTO`)

## Gamification Module
- **Response:** `AchievementDTO`, `UserAchievementDTO`, `ChallengeDTO`, `ChallengeParticipantDTO`, `GameDTO`, `GameSessionDTO`, `LeaderboardSnapshotDTO`
- **Request:** Thêm khi cần

## Social Module
- **Response:** `FriendshipDTO`, `GroupDTO`, `GroupMemberDTO`, `PostDTO`, `PostDetailDTO`, `CommentDTO`, `CommentDetailDTO`
- **Request:** Thêm khi cần (e.g. `CreatePostRequestDTO`)

## System Module
- **Response:** `NotificationDTO`, `ActivityLogDTO`, `ChatbotConversationDTO`, `ChatbotMessageDTO`
- **Request:** Thêm khi cần (e.g. `SendChatRequestDTO`)

## Response Helpers

### sendSuccess
```javascript
import { sendSuccess } from '../dto/index.js'

return sendSuccess(res, {
  statusCode: 200,
  message: 'Thành công',
  data: { user: new UserDTO(user) }
})
```

### sendError
```javascript
import { sendError } from '../dto/index.js'

return sendError(res, {
  statusCode: 400,
  message: 'Có lỗi xảy ra',
  errors: [{ field: 'email', message: 'Email không hợp lệ' }]
})
```

### sendPaginated
```javascript
import { sendPaginated } from '../dto/index.js'

return sendPaginated(res, {
  message: 'Lấy danh sách thành công',
  data: lessons.map(l => new LessonDTO(l)),
  pagination: {
    currentPage: 1,
    perPage: 10,
    total: 100,
    totalPages: 10
  }
})
```

## Standard Response Format

### Success Response
```json
{
  "success": true,
  "message": "Thành công",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Có lỗi xảy ra",
  "errors": [
    { "field": "email", "message": "..." }
  ]
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Thành công",
  "data": [...],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "perPage": 10,
      "total": 100,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## Usage in Controllers

```javascript
import { UserDTO, sendSuccess, sendError } from '../dto/index.js'

export const getUser = async (req, res, next) => {
  try {
    const user = await UserService.findById(req.params.id)
    
    return sendSuccess(res, {
      message: 'Lấy thông tin người dùng thành công',
      data: { user: new UserDTO(user) }
    })
  } catch (error) {
    return sendError(res, {
      statusCode: 404,
      message: 'Không tìm thấy người dùng'
    })
  }
}
```

## Best Practices

1. **Always use DTOs** - Never return raw Mongoose documents
2. **Consistent naming** - Use `...DTO` suffix
3. **Remove sensitive data** - DTOs filter out password, tokens, etc.
4. **Transform IDs** - Convert ObjectId to string
5. **Use appropriate DTO** - UserDTO vs UserProfileDTO based on context
6. **Nested DTOs** - Use DTOs inside DTOs (e.g., PostDetailDTO with UserProfileDTO)
