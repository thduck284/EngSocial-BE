# EngSocial API - Tài Liệu Chi Tiết Tất Cả API

> **Base URL:** `http://localhost:3000/api`
>
> **Header ngôn ngữ:** `Accept-Language: vi` hoặc `Accept-Language: en`
>
> **Header xác thực:** `Authorization: Bearer <accessToken>`

---

## Cấu trúc Response chuẩn

### Thành công

```json
{
  "success": true,
  "message": "Thành công",
  "data": {}
}
```

### Thành công có phân trang

```json
{
  "success": true,
  "message": "Thành công",
  "data": [],
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

### Lỗi

```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "errors": null
}
```

### Lỗi validation

```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    {
      "field": "email",
      "message": "\"email\" is required"
    }
  ]
}
```

---

## Mã lỗi HTTP

| Code | Ý nghĩa |
|------|----------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 400 | Dữ liệu không hợp lệ |
| 401 | Chưa xác thực / Token hết hạn |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 409 | Dữ liệu bị trùng |
| 500 | Lỗi server |

---

# 🔐 1. AUTH - Xác thực

## 1.1 POST `/api/auth/register` — Đăng ký

**Auth:** Không

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123",
  "name": "Nguyễn Văn A",
  "gender": "male",
  "dateOfBirth": "1999-05-15"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| email | string | ✅ | Email hợp lệ |
| password | string | ✅ | 8-128 ký tự, phải có chữ hoa, chữ thường, số |
| name | string | ✅ | 2-100 ký tự |
| gender | string | ❌ | `male` / `female` / `other` |
| dateOfBirth | string | ❌ | ISO date (YYYY-MM-DD) |

**Response 201:**

```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "id": "6601a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "name": "Nguyễn Văn A",
      "avatar": null,
      "bio": null,
      "phone": null,
      "address": null,
      "dateOfBirth": "1999-05-15T00:00:00.000Z",
      "gender": "male",
      "level": 1,
      "xp": 0,
      "totalXp": 0,
      "streak": 0,
      "longestStreak": 0,
      "lastActiveDate": null,
      "preferences": {
        "language": "vi",
        "theme": "system",
        "notifications": true,
        "emailNotifications": true,
        "dailyGoalMinutes": 30
      },
      "role": "user",
      "status": "active",
      "provider": "local",
      "emailVerified": false,
      "createdAt": "2024-01-15T08:30:00.000Z",
      "updatedAt": "2024-01-15T08:30:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Lỗi 409:**

```json
{
  "success": false,
  "message": "Email đã được sử dụng"
}
```

---

## 1.2 POST `/api/auth/login` — Đăng nhập

**Auth:** Không

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

| Field | Type | Required |
|-------|------|----------|
| email | string | ✅ |
| password | string | ✅ |

**Response 200:** (Giống response register)

```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": { "...tương tự register..." },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Lỗi 401:**

```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không đúng"
}
```

**Lỗi 403:**

```json
{
  "success": false,
  "message": "Tài khoản của bạn đã bị khóa"
}
```

---

## 1.3 POST `/api/auth/refresh` — Làm mới token

**Auth:** Không

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Làm mới token thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Lỗi 401:**

```json
{
  "success": false,
  "message": "Refresh token không hợp lệ hoặc đã hết hạn"
}
```

---

## 1.4 POST `/api/auth/logout` — Đăng xuất

**Auth:** Không

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

---

## 1.5 GET `/api/auth/me` — Lấy thông tin user hiện tại

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy thông tin người dùng thành công",
  "data": {
    "user": {
      "id": "6601a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "name": "Nguyễn Văn A",
      "avatar": null,
      "bio": null,
      "phone": null,
      "address": null,
      "dateOfBirth": "1999-05-15T00:00:00.000Z",
      "gender": "male",
      "level": 1,
      "xp": 0,
      "totalXp": 0,
      "streak": 0,
      "longestStreak": 0,
      "lastActiveDate": null,
      "preferences": {
        "language": "vi",
        "theme": "system",
        "notifications": true,
        "emailNotifications": true,
        "dailyGoalMinutes": 30
      },
      "role": "user",
      "status": "active",
      "provider": "local",
      "emailVerified": false,
      "createdAt": "2024-01-15T08:30:00.000Z",
      "updatedAt": "2024-01-15T08:30:00.000Z"
    }
  }
}
```

---

## 1.6 PATCH `/api/auth/preferences` — Cập nhật preferences

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "language": "en"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| language | string | ❌ | `vi` / `en` |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật preferences thành công",
  "data": {
    "user": { "...user object..." }
  }
}
```

---

## 1.7 POST `/api/auth/forgot-password` — Quên mật khẩu

**Auth:** Không

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response 200:** (Luôn trả 200 để bảo mật)

```json
{
  "success": true,
  "message": "Nếu email tồn tại, bạn sẽ nhận hướng dẫn đặt lại mật khẩu."
}
```

---

## 1.8 POST `/api/auth/reset-password` — Đặt lại mật khẩu

**Auth:** Không

**Request Body:**

```json
{
  "token": "abc123def456...",
  "newPassword": "NewPassword123"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| token | string | ✅ | Token nhận từ email |
| newPassword | string | ✅ | 8-128 ký tự, chữ hoa + thường + số |

**Response 200:**

```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập."
}
```

**Lỗi 400:**

```json
{
  "success": false,
  "message": "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."
}
```

---

# 👤 2. USER - Hồ sơ người dùng

## 2.1 GET `/api/user/profile` — Xem hồ sơ

**Auth:** ✅ Bearer Token

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy profile thành công",
  "data": {
    "user": { "...user object đầy đủ..." }
  }
}
```

---

## 2.2 PATCH `/api/user/profile` — Cập nhật hồ sơ

**Auth:** ✅ Bearer Token

**Request Body:** (ít nhất 1 field)

```json
{
  "name": "Nguyễn Văn B",
  "phone": "0901234567",
  "bio": "Tôi là sinh viên năm 3",
  "address": "TP. Hồ Chí Minh",
  "dateOfBirth": "1999-05-15",
  "gender": "male",
  "avatar": "https://res.cloudinary.com/xxx/image/upload/avatar.jpg"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| name | string | ❌ | 2-100 ký tự |
| phone | string | ❌ | Max 20 ký tự |
| bio | string | ❌ | Max 500 ký tự |
| address | string | ❌ | Max 300 ký tự |
| dateOfBirth | string | ❌ | ISO date |
| gender | string | ❌ | `male` / `female` / `other` |
| avatar | string | ❌ | URL, max 2000 ký tự |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật hồ sơ thành công.",
  "data": {
    "user": { "...user object cập nhật..." }
  }
}
```

---

# 📚 3. LESSONS - Bài học

## 3.1 GET `/api/lessons` — Danh sách bài học

**Auth:** Không

**Query Parameters:**

```
GET /api/lessons?skill=reading&level=A1&status=published&search=hello&featured=true&page=1&limit=10
```

| Param | Type | Default | Ghi chú |
|-------|------|---------|---------|
| skill | string | — | `reading` / `listening` / `writing` / `speaking` |
| level | string | — | `A1` / `A2` / `B1` / `B2` / `C1` / `C2` |
| status | string | `published` | `draft` / `published` / `archived` |
| search | string | — | Tìm theo title |
| featured | boolean | — | `true` / `false` |
| page | number | 1 | Trang |
| limit | number | 10 | Max 100 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách bài học thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9d0",
      "title": "Basic English Reading - Daily Life",
      "slug": "basic-english-reading-daily-life",
      "skill": "reading",
      "level": "A1",
      "topic": "Daily Life",
      "description": "Learn basic reading skills...",
      "thumbnail": "https://res.cloudinary.com/xxx/image.jpg",
      "estimatedTime": 15,
      "xpReward": 50,
      "totalQuestions": 10,
      "rating": 4.5,
      "ratingCount": 120,
      "completionCount": 500,
      "status": "published",
      "featured": true,
      "tags": ["beginner", "daily-life"],
      "createdAt": "2024-01-15T08:30:00.000Z",
      "updatedAt": "2024-01-15T08:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "perPage": 10,
      "total": 50,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 3.2 GET `/api/lessons/slug/:slug` — Chi tiết bài học theo slug

**Auth:** Không

**Ví dụ:** `GET /api/lessons/slug/basic-english-reading-daily-life`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy chi tiết bài học thành công",
  "data": {
    "lesson": {
      "id": "6601a1b2c3d4e5f6a7b8c9d0",
      "title": "Basic English Reading - Daily Life",
      "slug": "basic-english-reading-daily-life",
      "skill": "reading",
      "level": "A1",
      "topic": "Daily Life",
      "description": "Learn basic reading skills...",
      "thumbnail": "https://res.cloudinary.com/xxx/image.jpg",
      "content": {
        "text": "Nội dung bài đọc dài...",
        "wordCount": 350
      },
      "questions": [
        {
          "id": "q1",
          "question": "What is the main topic of this text?",
          "type": "multiple_choice",
          "options": [
            { "value": "a", "text": "Sports" },
            { "value": "b", "text": "Daily life" },
            { "value": "c", "text": "Travel" },
            { "value": "d", "text": "Food" }
          ],
          "correctAnswer": "b",
          "explanation": "The text discusses daily activities.",
          "points": 10
        },
        {
          "id": "q2",
          "question": "The author wakes up early every day.",
          "type": "true_false",
          "options": [
            { "value": "true", "text": "True" },
            { "value": "false", "text": "False" }
          ],
          "correctAnswer": "true",
          "explanation": "Paragraph 1 mentions waking up at 6am.",
          "points": 10
        },
        {
          "id": "q3",
          "question": "She ___ to school by bus.",
          "type": "fill_blank",
          "options": [],
          "correctAnswer": "goes",
          "explanation": "Simple present tense.",
          "points": 10
        }
      ],
      "vocabulary": [
        {
          "word": "routine",
          "phonetic": "/ruːˈtiːn/",
          "meaning": "a sequence of actions regularly followed",
          "meaningVi": "thói quen, lịch trình hàng ngày",
          "example": "My morning routine includes jogging.",
          "audioUrl": "https://api.dictionaryapi.dev/media/routine.mp3"
        }
      ],
      "estimatedTime": 15,
      "xpReward": 50,
      "totalQuestions": 10,
      "rating": 4.5,
      "ratingCount": 120,
      "completionCount": 500,
      "status": "published",
      "featured": true,
      "tags": ["beginner", "daily-life"],
      "createdBy": "6601a1b2c3d4e5f6a7b8c9d1",
      "createdAt": "2024-01-15T08:30:00.000Z",
      "updatedAt": "2024-01-15T08:30:00.000Z"
    }
  }
}
```

---

## 3.3 GET `/api/lessons/:id` — Chi tiết bài học theo ID

**Auth:** Không

**Ví dụ:** `GET /api/lessons/6601a1b2c3d4e5f6a7b8c9d0`

**Response 200:** Giống response 3.2

**Lỗi 404:**

```json
{
  "success": false,
  "message": "Không tìm thấy bài học"
}
```

---

## 3.4 POST `/api/lessons` — Tạo bài học mới

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Request Body:**

```json
{
  "title": "Listening Practice - At the Airport",
  "skill": "listening",
  "level": "B1",
  "topic": "Travel",
  "description": "Practice listening with airport announcements",
  "thumbnail": "https://res.cloudinary.com/xxx/airport.jpg",
  "content": {
    "audioUrl": "https://res.cloudinary.com/xxx/audio/airport.mp3",
    "transcript": "Attention passengers. Flight VN123...",
    "duration": 180,
    "accent": "american",
    "speed": 1.0,
    "chapters": [
      {
        "id": "ch1",
        "label": "Announcement 1",
        "time": "00:00",
        "startTime": 0
      },
      {
        "id": "ch2",
        "label": "Announcement 2",
        "time": "01:30",
        "startTime": 90
      }
    ]
  },
  "questions": [
    {
      "id": "q1",
      "question": "What is the flight number?",
      "type": "multiple_choice",
      "options": [
        { "value": "a", "text": "VN123" },
        { "value": "b", "text": "VN456" },
        { "value": "c", "text": "VN789" }
      ],
      "correctAnswer": "a",
      "explanation": "The announcement says Flight VN123.",
      "points": 10
    }
  ],
  "vocabulary": [
    {
      "word": "departure",
      "phonetic": "/dɪˈpɑːrtʃər/",
      "meaning": "the act of leaving",
      "meaningVi": "sự khởi hành",
      "example": "The departure time is 3pm.",
      "audioUrl": "https://example.com/departure.mp3"
    }
  ],
  "estimatedTime": 20,
  "xpReward": 60,
  "status": "draft",
  "featured": false,
  "tags": ["travel", "listening", "intermediate"]
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| title | string | ✅ | Max 200 ký tự |
| skill | string | ✅ | `reading` / `listening` / `writing` / `speaking` |
| level | string | ✅ | `A1` / `A2` / `B1` / `B2` / `C1` / `C2` |
| topic | string | ❌ | Max 200 ký tự |
| description | string | ❌ | Max 1000 ký tự |
| thumbnail | string | ❌ | URL, max 2000 |
| content | object | ❌ | Xem bên dưới |
| questions | array | ❌ | Mảng câu hỏi |
| vocabulary | array | ❌ | Mảng từ vựng |
| estimatedTime | number | ❌ | Phút |
| xpReward | number | ❌ | Điểm kinh nghiệm |
| status | string | ❌ | `draft` / `published` / `archived` |
| featured | boolean | ❌ | Default false |
| tags | array | ❌ | Mảng string |

**Content cho bài Writing:**

```json
{
  "content": {
    "prompt": "Write about your daily routine",
    "wordLimit": { "min": 100, "max": 300 },
    "sampleAnswer": "Every morning I wake up at 6am..."
  }
}
```

**Content cho bài Reading:**

```json
{
  "content": {
    "text": "The long reading passage...",
    "wordCount": 500
  }
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo bài học thành công",
  "data": {
    "lesson": { "...lesson detail object..." }
  }
}
```

---

## 3.5 PATCH `/api/lessons/:id` — Cập nhật bài học

**Auth:** ✅ Bearer Token (Người tạo / Admin)

**Ví dụ:** `PATCH /api/lessons/6601a1b2c3d4e5f6a7b8c9d0`

**Request Body:** (ít nhất 1 field, các field giống POST)

```json
{
  "title": "Updated Title",
  "status": "published",
  "featured": true
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật bài học thành công",
  "data": {
    "lesson": { "...lesson object cập nhật..." }
  }
}
```

**Lỗi 404:** `"Không tìm thấy bài học"`

---

## 3.6 DELETE `/api/lessons/:id` — Xóa bài học

**Auth:** ✅ Bearer Token (Người tạo / Admin)

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa bài học thành công"
}
```

---

## 3.7 POST `/api/lessons/:id/start` — Bắt đầu bài học

**Auth:** ✅ Bearer Token

**Ví dụ:** `POST /api/lessons/6601a1b2c3d4e5f6a7b8c9d0/start`

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Bắt đầu bài học thành công",
  "data": {
    "lesson": { "...lesson detail..." },
    "progress": {
      "id": "6601a1b2c3d4e5f6a7b8c9d2",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "lessonId": "6601a1b2c3d4e5f6a7b8c9d1",
      "status": "in_progress",
      "progress": 0,
      "score": 0,
      "maxScore": 100,
      "xpEarned": 0,
      "attempts": 0,
      "bestScore": 0,
      "timeSpent": 0,
      "startedAt": "2024-01-15T08:30:00.000Z",
      "completedAt": null,
      "lastAccessedAt": "2024-01-15T08:30:00.000Z"
    }
  }
}
```

---

## 3.8 POST `/api/lessons/:id/submit` — Nộp bài trắc nghiệm

**Auth:** ✅ Bearer Token

**Ví dụ:** `POST /api/lessons/6601a1b2c3d4e5f6a7b8c9d0/submit`

**Request Body:**

```json
{
  "answers": [
    { "questionId": "q1", "answer": "b" },
    { "questionId": "q2", "answer": "true" },
    { "questionId": "q3", "answer": "goes" }
  ],
  "timeSpent": 450
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| answers | array | ✅ | Ít nhất 1 câu trả lời |
| answers[].questionId | string | ✅ | ID câu hỏi |
| answers[].answer | string/array | ✅ | Đáp án |
| timeSpent | number | ❌ | Giây |

**Response 200:**

```json
{
  "success": true,
  "message": "Nộp bài thành công",
  "data": {
    "progress": {
      "id": "6601a1b2c3d4e5f6a7b8c9d2",
      "status": "completed",
      "progress": 100,
      "score": 90,
      "maxScore": 100,
      "xpEarned": 50,
      "attempts": 1,
      "bestScore": 90,
      "timeSpent": 450,
      "completedAt": "2024-01-15T08:45:00.000Z"
    }
  }
}
```

---

## 3.9 POST `/api/lessons/:id/submit-writing` — Nộp bài viết

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "content": "Every morning I wake up at 6am. I brush my teeth and have breakfast with my family. Then I go to school by bus...",
  "wordCount": 150
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| content | string | ✅ | Nội dung bài viết, min 1 ký tự |
| wordCount | number | ❌ | Số từ |

**Response 200:**

```json
{
  "success": true,
  "message": "Nộp bài viết thành công",
  "data": {
    "progress": {
      "status": "completed",
      "submission": {
        "content": "Every morning I wake up at 6am...",
        "wordCount": 150,
        "submittedAt": "2024-01-15T08:50:00.000Z"
      },
      "xpEarned": 50
    }
  }
}
```

---

## 3.10 GET `/api/lessons/user/progress` — Tiến trình học tập

**Auth:** ✅ Bearer Token

**Query Parameters:**

```
GET /api/lessons/user/progress?skill=reading&status=completed&page=1&limit=10
```

| Param | Type | Ghi chú |
|-------|------|---------|
| skill | string | `reading` / `listening` / `writing` |
| status | string | `not_started` / `in_progress` / `completed` |
| page | number | Default 1 |
| limit | number | Default 10, max 100 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy tiến trình thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9d2",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "lessonId": "6601a1b2c3d4e5f6a7b8c9d1",
      "status": "completed",
      "progress": 100,
      "score": 90,
      "maxScore": 100,
      "xpEarned": 50,
      "attempts": 1,
      "bestScore": 90,
      "timeSpent": 450,
      "lesson": {
        "id": "6601a1b2c3d4e5f6a7b8c9d1",
        "title": "Basic English Reading",
        "skill": "reading",
        "level": "A1"
      }
    }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "perPage": 10,
      "total": 15,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 3.11 GET `/api/lessons/user/skill-stats` — Thống kê kỹ năng

**Auth:** ✅ Bearer Token

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy thống kê kỹ năng thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9d3",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "skill": "reading",
      "totalTimeSpent": 3600,
      "weeklyTimeSpent": 600,
      "dailyTimeSpent": 120,
      "lessonsCompleted": 15,
      "lessonsInProgress": 2,
      "averageScore": 85.5,
      "highestScore": 95,
      "totalXpEarned": 1000,
      "skillLevel": "B1",
      "lastActivityAt": "2024-01-15T08:30:00.000Z"
    },
    {
      "skill": "listening",
      "lessonsCompleted": 8,
      "averageScore": 78.0,
      "totalXpEarned": 500,
      "skillLevel": "A2"
    }
  ]
}
```

---

# 🎯 4. SKILLS - Kỹ năng

## 4.1 GET `/api/skills` — Danh sách kỹ năng

**Auth:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách kỹ năng thành công",
  "data": {
    "skills": [
      {
        "id": "6601a1b2c3d4e5f6a7b8c9d4",
        "key": "reading",
        "name": "Reading",
        "nameVi": "Đọc",
        "icon": "📖",
        "description": "Improve your reading comprehension",
        "descriptionVi": "Cải thiện kỹ năng đọc hiểu",
        "color": "#4CAF50",
        "order": 0
      },
      {
        "id": "6601a1b2c3d4e5f6a7b8c9d5",
        "key": "listening",
        "name": "Listening",
        "nameVi": "Nghe",
        "icon": "🎧",
        "description": "Train your listening skills",
        "descriptionVi": "Rèn luyện kỹ năng nghe",
        "color": "#2196F3",
        "order": 1
      },
      {
        "id": "6601a1b2c3d4e5f6a7b8c9d6",
        "key": "writing",
        "name": "Writing",
        "nameVi": "Viết",
        "icon": "✍️",
        "description": "Practice your writing",
        "descriptionVi": "Thực hành kỹ năng viết",
        "color": "#FF9800",
        "order": 2
      },
      {
        "id": "6601a1b2c3d4e5f6a7b8c9d7",
        "key": "speaking",
        "name": "Speaking",
        "nameVi": "Nói",
        "icon": "🗣️",
        "description": "Improve your speaking",
        "descriptionVi": "Cải thiện kỹ năng nói",
        "color": "#E91E63",
        "order": 3
      }
    ]
  }
}
```

---

## 4.2 GET `/api/skills/:key` — Chi tiết kỹ năng

**Auth:** Không

**Ví dụ:** `GET /api/skills/reading`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy chi tiết kỹ năng thành công",
  "data": {
    "skill": {
      "id": "6601a1b2c3d4e5f6a7b8c9d4",
      "key": "reading",
      "name": "Reading",
      "nameVi": "Đọc",
      "icon": "📖",
      "description": "Improve your reading comprehension",
      "descriptionVi": "Cải thiện kỹ năng đọc hiểu",
      "color": "#4CAF50",
      "order": 0
    }
  }
}
```

**Lỗi 404:**

```json
{
  "success": false,
  "message": "Không tìm thấy kỹ năng"
}
```

---

## 4.3 POST `/api/skills` — Tạo kỹ năng (Admin)

**Auth:** ✅ Bearer Token (Admin)

**Request Body:**

```json
{
  "key": "grammar",
  "name": "Grammar",
  "nameVi": "Ngữ pháp",
  "icon": "📝",
  "description": "Learn English grammar",
  "descriptionVi": "Học ngữ pháp tiếng Anh",
  "color": "#9C27B0",
  "order": 4
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo kỹ năng thành công",
  "data": {
    "skill": { "...skill object..." }
  }
}
```

---

# 📅 5. DAILY GOALS - Mục tiêu hàng ngày

## 5.1 GET `/api/daily-goals/today` — Mục tiêu hôm nay

**Auth:** ✅ Bearer Token

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy mục tiêu hôm nay thành công",
  "data": {
    "dailyGoal": {
      "_id": "6601a1b2c3d4e5f6a7b8c9d8",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "date": "2024-01-15T00:00:00.000Z",
      "goals": [
        {
          "id": "lessons",
          "type": "lessons",
          "description": "Complete 3 lessons",
          "target": 3,
          "current": 1,
          "completed": false,
          "completedAt": null
        },
        {
          "id": "xp",
          "type": "xp",
          "description": "Earn 50 XP",
          "target": 50,
          "current": 20,
          "completed": false,
          "completedAt": null
        },
        {
          "id": "time",
          "type": "time",
          "description": "Study for 15 minutes",
          "target": 15,
          "current": 5,
          "completed": false,
          "completedAt": null
        }
      ],
      "allCompleted": false,
      "xpBonus": 0,
      "createdAt": "2024-01-15T00:00:00.000Z",
      "updatedAt": "2024-01-15T08:30:00.000Z"
    }
  }
}
```

---

## 5.2 PATCH `/api/daily-goals/progress` — Cập nhật tiến trình mục tiêu

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "goalId": "lessons",
  "increment": 1
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| goalId | string | ✅ | `lessons` / `xp` / `time` |
| increment | number | ❌ | Default 1 |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật tiến trình thành công",
  "data": {
    "dailyGoal": {
      "goals": [
        {
          "id": "lessons",
          "type": "lessons",
          "target": 3,
          "current": 3,
          "completed": true,
          "completedAt": "2024-01-15T10:00:00.000Z"
        },
        {
          "id": "xp",
          "type": "xp",
          "target": 50,
          "current": 50,
          "completed": true,
          "completedAt": "2024-01-15T10:00:00.000Z"
        },
        {
          "id": "time",
          "type": "time",
          "target": 15,
          "current": 15,
          "completed": true,
          "completedAt": "2024-01-15T10:00:00.000Z"
        }
      ],
      "allCompleted": true,
      "xpBonus": 30
    }
  }
}
```

**Lỗi 404:**

```json
{
  "success": false,
  "message": "Không tìm thấy mục tiêu"
}
```

---

## 5.3 GET `/api/daily-goals/history` — Lịch sử mục tiêu

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=10`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy lịch sử mục tiêu thành công",
  "data": [
    {
      "_id": "6601a1b2c3d4e5f6a7b8c9d8",
      "date": "2024-01-15T00:00:00.000Z",
      "goals": [
        { "id": "lessons", "target": 3, "current": 3, "completed": true },
        { "id": "xp", "target": 50, "current": 50, "completed": true },
        { "id": "time", "target": 15, "current": 15, "completed": true }
      ],
      "allCompleted": true,
      "xpBonus": 30
    },
    {
      "date": "2024-01-14T00:00:00.000Z",
      "goals": [
        { "id": "lessons", "target": 3, "current": 2, "completed": false }
      ],
      "allCompleted": false,
      "xpBonus": 0
    }
  ],
  "meta": {
    "pagination": { "currentPage": 1, "perPage": 10, "total": 30, "totalPages": 3, "hasNextPage": true, "hasPrevPage": false }
  }
}
```

---

# 🏆 6. CHALLENGES - Thử thách

## 6.1 GET `/api/challenges` — Danh sách thử thách

**Auth:** Không

**Query Parameters:**

```
GET /api/challenges?type=weekly&skill=reading&status=active&page=1&limit=10
```

| Param | Type | Ghi chú |
|-------|------|---------|
| type | string | `daily` / `weekly` / `monthly` / `special` |
| skill | string | `reading` / `listening` / `writing` / `all` |
| status | string | `upcoming` / `active` / `ended` |
| page | number | Default 1 |
| limit | number | Default 10 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách thử thách thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9e0",
      "title": "Weekly Reading Challenge",
      "titleVi": "Thử thách đọc hàng tuần",
      "description": "Complete 5 reading lessons this week",
      "descriptionVi": "Hoàn thành 5 bài đọc tuần này",
      "type": "weekly",
      "skill": "reading",
      "requirement": {
        "type": "lessons",
        "target": 5
      },
      "xpReward": 200,
      "badge": "📖",
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-21T23:59:59.000Z",
      "participantCount": 150,
      "completedCount": 45,
      "icon": "🏆",
      "color": "#FFD700",
      "status": "active",
      "createdAt": "2024-01-14T00:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "currentPage": 1, "perPage": 10, "total": 5, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
  }
}
```

---

## 6.2 GET `/api/challenges/:id` — Chi tiết thử thách

**Auth:** Không

**Response 200:** Một object challenge (giống trên)

**Lỗi 404:** `"Không tìm thấy thử thách"`

---

## 6.3 GET `/api/challenges/me` — Thử thách của tôi

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=10`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách thử thách của người dùng thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9e1",
      "challengeId": "6601a1b2c3d4e5f6a7b8c9e0",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "progress": 3,
      "target": 5,
      "completed": false,
      "rank": 12,
      "xpEarned": 0,
      "joinedAt": "2024-01-15T08:00:00.000Z",
      "challenge": {
        "id": "6601a1b2c3d4e5f6a7b8c9e0",
        "title": "Weekly Reading Challenge",
        "type": "weekly"
      }
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 6.4 POST `/api/challenges` — Tạo thử thách (Admin/Teacher)

**Auth:** ✅ Bearer Token (Admin/Teacher)

**Request Body:**

```json
{
  "title": "Monthly Listening Marathon",
  "titleVi": "Marathon nghe hàng tháng",
  "description": "Listen to 20 lessons this month",
  "descriptionVi": "Nghe 20 bài học trong tháng",
  "type": "monthly",
  "skill": "listening",
  "requirement": {
    "type": "lessons",
    "target": 20
  },
  "xpReward": 500,
  "badge": "🎧",
  "startDate": "2024-02-01T00:00:00.000Z",
  "endDate": "2024-02-29T23:59:59.000Z",
  "icon": "🎯",
  "color": "#2196F3"
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo thử thách thành công",
  "data": {
    "challenge": { "...challenge object..." }
  }
}
```

---

## 6.5 POST `/api/challenges/:id/join` — Tham gia thử thách

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 201:**

```json
{
  "success": true,
  "message": "Tham gia thử thách thành công",
  "data": {
    "participant": {
      "id": "6601a1b2c3d4e5f6a7b8c9e1",
      "challengeId": "6601a1b2c3d4e5f6a7b8c9e0",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "progress": 0,
      "target": 5,
      "completed": false,
      "joinedAt": "2024-01-15T08:00:00.000Z"
    }
  }
}
```

**Lỗi 409:**

```json
{
  "success": false,
  "message": "Bạn đã tham gia thử thách này rồi"
}
```

---

## 6.6 PATCH `/api/challenges/:id/progress` — Cập nhật tiến trình

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "progress": 4
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật tiến trình thử thách thành công",
  "data": {
    "participant": {
      "progress": 4,
      "target": 5,
      "completed": false,
      "xpEarned": 0
    }
  }
}
```

---

## 6.7 GET `/api/challenges/:id/leaderboard` — BXH thử thách

**Auth:** Không

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy bảng xếp hạng thử thách thành công",
  "data": [
    {
      "rank": 1,
      "user": {
        "id": "6601a1b2c3d4e5f6a7b8c9d0",
        "name": "Nguyễn Văn A",
        "avatar": "https://...",
        "level": 15
      },
      "progress": 5,
      "target": 5,
      "completed": true,
      "xpEarned": 200
    },
    {
      "rank": 2,
      "user": {
        "id": "6601a1b2c3d4e5f6a7b8c9d9",
        "name": "Trần Thị B",
        "avatar": null,
        "level": 10
      },
      "progress": 4,
      "target": 5,
      "completed": false,
      "xpEarned": 0
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

# 🎮 7. GAMES - Trò chơi

## 7.1 GET `/api/games` — Danh sách game

**Auth:** Không

**Query Parameters:**

```
GET /api/games?type=vocabulary&difficulty=easy&status=active&page=1&limit=10
```

| Param | Type | Ghi chú |
|-------|------|---------|
| type | string | `vocabulary` / `grammar` / `mixed` / `quiz` |
| difficulty | string | `easy` / `medium` / `hard` |
| status | string | `active` / `maintenance` / `disabled` |
| page | number | Default 1 |
| limit | number | Default 10 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách trò chơi thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9f0",
      "key": "vocab_match",
      "title": "Vocabulary Match",
      "titleVi": "Ghép Từ Vựng",
      "description": "Match English words with their meanings",
      "descriptionVi": "Ghép từ tiếng Anh với nghĩa của chúng",
      "type": "vocabulary",
      "difficulty": "easy",
      "icon": "🎮",
      "color": "#4CAF50",
      "bgColor": "#E8F5E9",
      "playCount": 1500,
      "currentPlaying": 5,
      "rating": 4.7,
      "ratingCount": 200,
      "config": {
        "timeLimit": 300,
        "questionsPerRound": 10,
        "xpPerCorrect": 5,
        "streakBonus": true
      },
      "status": "active",
      "featured": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 7.2 GET `/api/games/:id` — Chi tiết game

**Auth:** Không

**Ví dụ:** `GET /api/games/6601a1b2c3d4e5f6a7b8c9f0`

**Response 200:** Một game object

**Lỗi 404:** `"Không tìm thấy trò chơi"`

---

## 7.3 POST `/api/games` — Tạo game (Admin/Teacher)

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "key": "grammar_quiz",
  "title": "Grammar Quiz",
  "titleVi": "Trắc Nghiệm Ngữ Pháp",
  "description": "Test your grammar knowledge",
  "descriptionVi": "Kiểm tra kiến thức ngữ pháp",
  "type": "grammar",
  "difficulty": "medium",
  "icon": "📝",
  "color": "#9C27B0",
  "bgColor": "#F3E5F5",
  "config": {
    "timeLimit": 600,
    "questionsPerRound": 20,
    "xpPerCorrect": 10,
    "streakBonus": true
  },
  "status": "active",
  "featured": false
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo trò chơi thành công",
  "data": {
    "game": { "...game object..." }
  }
}
```

---

## 7.4 POST `/api/games/:id/start` — Bắt đầu chơi

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 201:**

```json
{
  "success": true,
  "message": "Bắt đầu phiên chơi thành công",
  "data": {
    "session": {
      "id": "6601a1b2c3d4e5f6a7b8c9f1",
      "gameId": "6601a1b2c3d4e5f6a7b8c9f0",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "score": 0,
      "correctAnswers": 0,
      "totalQuestions": 10,
      "streak": 0,
      "xpEarned": 0,
      "duration": 0,
      "startedAt": "2024-01-15T09:00:00.000Z",
      "endedAt": null
    }
  }
}
```

---

## 7.5 POST `/api/games/sessions/:sessionId/submit` — Nộp kết quả

**Auth:** ✅ Bearer Token

**Ví dụ:** `POST /api/games/sessions/6601a1b2c3d4e5f6a7b8c9f1/submit`

**Request Body:**

```json
{
  "answers": [
    { "questionId": "q1", "answer": "a", "isCorrect": true, "timeSpent": 8 },
    { "questionId": "q2", "answer": "b", "isCorrect": true, "timeSpent": 12 },
    { "questionId": "q3", "answer": "c", "isCorrect": false, "timeSpent": 15 },
    { "questionId": "q4", "answer": "a", "isCorrect": true, "timeSpent": 6 }
  ],
  "duration": 120
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| answers | array | ✅ | Mảng câu trả lời |
| answers[].questionId | string | ✅ | ID câu hỏi |
| answers[].answer | string | ✅ | Đáp án |
| answers[].isCorrect | boolean | ✅ | Đúng/sai |
| answers[].timeSpent | number | ❌ | Giây trả lời |
| duration | number | ❌ | Tổng thời gian (giây) |

**Response 200:**

```json
{
  "success": true,
  "message": "Nộp kết quả thành công",
  "data": {
    "session": {
      "id": "6601a1b2c3d4e5f6a7b8c9f1",
      "score": 85,
      "correctAnswers": 8,
      "totalQuestions": 10,
      "streak": 4,
      "xpEarned": 55,
      "duration": 120,
      "endedAt": "2024-01-15T09:02:00.000Z"
    }
  }
}
```

---

## 7.6 GET `/api/games/history` — Lịch sử chơi

**Auth:** ✅ Bearer Token

**Query:** `?gameId=6601a1b2c3d4e5f6a7b8c9f0&page=1&limit=10`

| Param | Type | Ghi chú |
|-------|------|---------|
| gameId | string | Lọc theo game (optional) |
| page | number | Default 1 |
| limit | number | Default 10 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy lịch sử chơi thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9f1",
      "gameId": "6601a1b2c3d4e5f6a7b8c9f0",
      "score": 85,
      "correctAnswers": 8,
      "totalQuestions": 10,
      "xpEarned": 55,
      "duration": 120,
      "startedAt": "2024-01-15T09:00:00.000Z",
      "endedAt": "2024-01-15T09:02:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

# 🏅 8. LEADERBOARD - Bảng xếp hạng

## 8.1 GET `/api/leaderboard` — Xem bảng xếp hạng

**Auth:** Không

**Query Parameters:**

```
GET /api/leaderboard?type=xp&period=weekly
```

| Param | Type | Default | Ghi chú |
|-------|------|---------|---------|
| type | string | `xp` | `xp` / `level` / `streak` |
| period | string | `weekly` | `weekly` / `monthly` / `all_time` |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy bảng xếp hạng thành công",
  "data": {
    "leaderboard": {
      "id": "6601a1b2c3d4e5f6a7b8c9f2",
      "type": "weekly",
      "period": "2024-W03",
      "entries": [
        {
          "rank": 1,
          "userId": "6601a1b2c3d4e5f6a7b8c9d0",
          "name": "Nguyễn Văn A",
          "avatar": "https://...",
          "xp": 5000,
          "level": 25
        },
        {
          "rank": 2,
          "userId": "6601a1b2c3d4e5f6a7b8c9d9",
          "name": "Trần Thị B",
          "avatar": null,
          "xp": 4500,
          "level": 22
        },
        {
          "rank": 3,
          "userId": "6601a1b2c3d4e5f6a7b8c9da",
          "name": "Lê Văn C",
          "avatar": "https://...",
          "xp": 4200,
          "level": 20
        }
      ],
      "generatedAt": "2024-01-15T00:00:00.000Z"
    }
  }
}
```

---

## 8.2 POST `/api/leaderboard/generate` — Tạo bảng xếp hạng (Admin)

**Auth:** ✅ Bearer Token (Admin)

**Request Body:**

```json
{
  "type": "weekly"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| type | string | ❌ | `weekly` / `monthly` / `all_time` |

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo bảng xếp hạng thành công",
  "data": {
    "leaderboard": { "...leaderboard object..." }
  }
}
```

---

# 📝 9. COMMUNITY - Bài viết & Bình luận

## 9.1 GET `/api/community/posts` — Danh sách bài viết

**Auth:** Không

**Query Parameters:**

```
GET /api/community/posts?visibility=public&search=english&page=1&limit=10
```

| Param | Type | Ghi chú |
|-------|------|---------|
| visibility | string | `public` / `friends` / `group` / `private` |
| groupId | string | Lọc theo nhóm |
| authorId | string | Lọc theo tác giả |
| search | string | Tìm kiếm |
| page | number | Default 1 |
| limit | number | Default 10 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách bài viết thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8ca00",
      "author": {
        "id": "6601a1b2c3d4e5f6a7b8c9d0",
        "name": "Nguyễn Văn A",
        "avatar": "https://...",
        "level": 10,
        "totalXp": 2500
      },
      "content": "Hôm nay mình học được từ mới rất hay! 'Perseverance' - sự kiên trì 💪",
      "images": [
        "https://res.cloudinary.com/xxx/image1.jpg",
        "https://res.cloudinary.com/xxx/image2.jpg"
      ],
      "video": null,
      "likeCount": 25,
      "commentCount": 8,
      "shareCount": 2,
      "lessonId": null,
      "challengeId": null,
      "visibility": "public",
      "status": "active",
      "tags": ["vocabulary", "motivation"],
      "mentions": [],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 9.2 GET `/api/community/posts/:id` — Chi tiết bài viết

**Auth:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy chi tiết bài viết thành công",
  "data": {
    "post": {
      "id": "6601a1b2c3d4e5f6a7b8ca00",
      "author": { "id": "...", "name": "...", "avatar": "...", "level": 10 },
      "content": "Hôm nay mình học được từ mới...",
      "images": [],
      "video": null,
      "likeCount": 25,
      "commentCount": 8,
      "visibility": "public",
      "status": "active",
      "tags": ["vocabulary"],
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

## 9.3 POST `/api/community/posts` — Tạo bài viết

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "content": "Hôm nay mình vừa hoàn thành 5 bài đọc! Cảm thấy tiến bộ rất nhiều 📚🎉",
  "images": [
    "https://res.cloudinary.com/xxx/image1.jpg"
  ],
  "video": null,
  "visibility": "public",
  "tags": ["achievement", "reading"],
  "mentions": ["6601a1b2c3d4e5f6a7b8c9d9"],
  "lessonId": "6601a1b2c3d4e5f6a7b8c9d1",
  "challengeId": null
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| content | string | ✅ | Max 5000 ký tự |
| images | array | ❌ | Max 10 ảnh, mỗi URL max 2000 |
| video | string | ❌ | URL video, max 2000 |
| visibility | string | ❌ | `public` / `friends` / `group` / `private`. Default: `public` |
| groupId | string | ❌ | Bắt buộc khi visibility = `group` |
| tags | array | ❌ | Max 50 ký tự mỗi tag |
| mentions | array | ❌ | Mảng userId |
| lessonId | string | ❌ | Liên kết bài học |
| challengeId | string | ❌ | Liên kết thử thách |

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo bài viết thành công",
  "data": {
    "post": { "...post object..." }
  }
}
```

---

## 9.4 PATCH `/api/community/posts/:id` — Cập nhật bài viết

**Auth:** ✅ Bearer Token (Chủ bài viết)

**Request Body:** (ít nhất 1 field)

```json
{
  "content": "Nội dung cập nhật...",
  "tags": ["updated-tag"]
}
```

| Field | Type | Required |
|-------|------|----------|
| content | string | ❌ |
| images | array | ❌ |
| video | string | ❌ |
| visibility | string | ❌ |
| tags | array | ❌ |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật bài viết thành công",
  "data": {
    "post": { "...post cập nhật..." }
  }
}
```

**Lỗi 403:** `"Bạn không có quyền thực hiện hành động này"`

---

## 9.5 DELETE `/api/community/posts/:id` — Xóa bài viết

**Auth:** ✅ Bearer Token (Chủ bài viết)

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa bài viết thành công"
}
```

---

## 9.6 POST `/api/community/posts/:id/like` — Like / Bỏ like

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật lượt thích thành công",
  "data": {
    "liked": true
  }
}
```

> Gọi lại lần 2 sẽ bỏ like:

```json
{
  "success": true,
  "message": "Cập nhật lượt thích thành công",
  "data": {
    "liked": false
  }
}
```

---

## 9.7 GET `/api/community/posts/:postId/comments` — Danh sách bình luận

**Auth:** Không

**Query Parameters:**

```
GET /api/community/posts/6601a1b2c3d4e5f6a7b8ca00/comments?parentId=null&page=1&limit=20
```

| Param | Type | Ghi chú |
|-------|------|---------|
| parentId | string | Xem reply của comment (optional) |
| page | number | Default 1 |
| limit | number | Default 20 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách bình luận thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8ca01",
      "postId": "6601a1b2c3d4e5f6a7b8ca00",
      "author": {
        "id": "6601a1b2c3d4e5f6a7b8c9d9",
        "name": "Trần Thị B",
        "avatar": "https://...",
        "level": 8,
        "totalXp": 1800
      },
      "parentId": null,
      "content": "Tuyệt vời! Bạn giỏi quá 👏",
      "likeCount": 3,
      "replyCount": 1,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 9.8 POST `/api/community/posts/:postId/comments` — Tạo bình luận

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "content": "Cảm ơn bạn! Mình cũng đang cố gắng 💪",
  "parentId": null
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| content | string | ✅ | Max 1000 ký tự |
| parentId | string | ❌ | ID comment cha (để reply) |

**Ví dụ reply:**

```json
{
  "content": "Cảm ơn! @TrầnThịB",
  "parentId": "6601a1b2c3d4e5f6a7b8ca01"
}
```

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo bình luận thành công",
  "data": {
    "comment": {
      "id": "6601a1b2c3d4e5f6a7b8ca02",
      "postId": "6601a1b2c3d4e5f6a7b8ca00",
      "author": { "id": "...", "name": "...", "avatar": "..." },
      "parentId": null,
      "content": "Cảm ơn bạn! Mình cũng đang cố gắng 💪",
      "likeCount": 0,
      "replyCount": 0,
      "status": "active",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  }
}
```

---

## 9.9 DELETE `/api/community/comments/:commentId` — Xóa bình luận

**Auth:** ✅ Bearer Token (Chủ bình luận)

**Ví dụ:** `DELETE /api/community/comments/6601a1b2c3d4e5f6a7b8ca01`

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa bình luận thành công"
}
```

---

# 👫 10. FRIENDS - Kết bạn

## 10.1 GET `/api/friends` — Danh sách bạn bè

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách bạn bè thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8cb00",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "friendId": "6601a1b2c3d4e5f6a7b8c9d9",
      "status": "accepted",
      "acceptedAt": "2024-01-10T08:00:00.000Z",
      "createdAt": "2024-01-09T15:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 10.2 GET `/api/friends/requests/pending` — Lời mời chờ xử lý

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách lời mời chờ thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8cb01",
      "userId": "6601a1b2c3d4e5f6a7b8c9da",
      "friendId": "6601a1b2c3d4e5f6a7b8c9d0",
      "status": "pending",
      "createdAt": "2024-01-14T12:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 10.3 GET `/api/friends/requests/sent` — Lời mời đã gửi

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=20`

**Response 200:** Giống 10.2

---

## 10.4 POST `/api/friends/request/:userId` — Gửi lời mời kết bạn

**Auth:** ✅ Bearer Token

**Ví dụ:** `POST /api/friends/request/6601a1b2c3d4e5f6a7b8c9d9`

**Request Body:** Không

**Response 201:**

```json
{
  "success": true,
  "message": "Gửi lời mời kết bạn thành công",
  "data": {
    "friendship": {
      "id": "6601a1b2c3d4e5f6a7b8cb02",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "friendId": "6601a1b2c3d4e5f6a7b8c9d9",
      "status": "pending",
      "createdAt": "2024-01-15T11:00:00.000Z"
    }
  }
}
```

**Lỗi 400:** `"Không thể tự kết bạn với chính mình"`

**Lỗi 409:** `"Đã gửi lời mời kết bạn"` hoặc `"Đã là bạn bè"`

---

## 10.5 PATCH `/api/friends/request/:id/accept` — Chấp nhận lời mời

**Auth:** ✅ Bearer Token

**Ví dụ:** `PATCH /api/friends/request/6601a1b2c3d4e5f6a7b8cb01/accept`

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Chấp nhận lời mời kết bạn thành công",
  "data": {
    "friendship": {
      "id": "6601a1b2c3d4e5f6a7b8cb01",
      "status": "accepted",
      "acceptedAt": "2024-01-15T11:30:00.000Z"
    }
  }
}
```

**Lỗi 404:** `"Không tìm thấy lời mời kết bạn"`

---

## 10.6 DELETE `/api/friends/request/:id` — Từ chối / Hủy lời mời

**Auth:** ✅ Bearer Token

**Ví dụ:** `DELETE /api/friends/request/6601a1b2c3d4e5f6a7b8cb01`

**Response 200:**

```json
{
  "success": true,
  "message": "Từ chối lời mời kết bạn thành công"
}
```

---

## 10.7 DELETE `/api/friends/:userId` — Hủy kết bạn

**Auth:** ✅ Bearer Token

**Ví dụ:** `DELETE /api/friends/6601a1b2c3d4e5f6a7b8c9d9`

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa bạn bè thành công"
}
```

**Lỗi 404:** `"Không phải bạn bè"`

---

# 👥 11. GROUPS - Nhóm

## 11.1 GET `/api/groups` — Danh sách nhóm

**Auth:** Không

**Query Parameters:**

```
GET /api/groups?type=public&category=Learning&search=english&page=1&limit=10
```

| Param | Type | Ghi chú |
|-------|------|---------|
| type | string | `public` / `private` / `invite_only` |
| category | string | Danh mục |
| search | string | Tìm kiếm |
| page | number | Default 1 |
| limit | number | Default 10 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách nhóm thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8cc00",
      "name": "English Learners VN",
      "slug": "english-learners-vn",
      "description": "Nhóm học tiếng Anh cho người Việt",
      "icon": "🇬🇧",
      "coverImage": "https://res.cloudinary.com/xxx/cover.jpg",
      "color": "#1976D2",
      "type": "public",
      "category": "Learning",
      "memberCount": 250,
      "postCount": 1500,
      "rules": [
        "Chỉ đăng nội dung liên quan tiếng Anh",
        "Không spam, quảng cáo",
        "Tôn trọng mọi người"
      ],
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 11.2 GET `/api/groups/me` — Nhóm của tôi

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=10`

**Response 200:** Danh sách nhóm user đã tham gia

---

## 11.3 GET `/api/groups/:id` — Chi tiết nhóm

**Auth:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy chi tiết nhóm thành công",
  "data": {
    "group": { "...group object..." }
  }
}
```

**Lỗi 404:** `"Không tìm thấy nhóm"`

---

## 11.4 POST `/api/groups` — Tạo nhóm

**Auth:** ✅ Bearer Token

**Request Body:**

```json
{
  "name": "IELTS Study Group",
  "description": "Nhóm ôn thi IELTS, chia sẻ tài liệu và kinh nghiệm",
  "icon": "📚",
  "coverImage": "https://res.cloudinary.com/xxx/ielts-cover.jpg",
  "color": "#FF5722",
  "type": "public",
  "category": "IELTS",
  "rules": [
    "Chỉ đăng tài liệu IELTS",
    "Chia sẻ kinh nghiệm thi",
    "Không spam"
  ]
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| name | string | ✅ | Max 100 ký tự |
| description | string | ❌ | Max 500 ký tự |
| icon | string | ❌ | Emoji |
| coverImage | string | ❌ | URL |
| color | string | ❌ | Hex color |
| type | string | ❌ | `public` / `private` / `invite_only` |
| category | string | ❌ | Danh mục |
| rules | array | ❌ | Mảng string |

**Response 201:**

```json
{
  "success": true,
  "message": "Tạo nhóm thành công",
  "data": {
    "group": { "...group object (user tự động là owner)..." }
  }
}
```

---

## 11.5 POST `/api/groups/:id/join` — Tham gia nhóm

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 201:**

```json
{
  "success": true,
  "message": "Tham gia nhóm thành công",
  "data": {
    "member": {
      "id": "6601a1b2c3d4e5f6a7b8cc01",
      "groupId": "6601a1b2c3d4e5f6a7b8cc00",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "role": "member",
      "status": "active",
      "joinedAt": "2024-01-15T12:00:00.000Z"
    }
  }
}
```

**Lỗi 409:** `"Bạn đã là thành viên nhóm này"`

---

## 11.6 POST `/api/groups/:id/leave` — Rời nhóm

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Rời nhóm thành công"
}
```

**Lỗi 400:** `"Chủ nhóm không thể rời nhóm"`

**Lỗi 404:** `"Bạn không phải thành viên nhóm này"`

---

## 11.7 GET `/api/groups/:id/members` — Danh sách thành viên

**Auth:** Không

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách thành viên thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8cc01",
      "groupId": "6601a1b2c3d4e5f6a7b8cc00",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "role": "owner",
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "role": "member",
      "userId": "6601a1b2c3d4e5f6a7b8c9d9",
      "joinedAt": "2024-01-10T00:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

# 🔔 12. NOTIFICATIONS - Thông báo

## 12.1 GET `/api/notifications` — Danh sách thông báo

**Auth:** ✅ Bearer Token

**Query Parameters:**

```
GET /api/notifications?read=false&page=1&limit=30
```

| Param | Type | Ghi chú |
|-------|------|---------|
| read | boolean | `true` / `false` lọc đã đọc/chưa đọc |
| page | number | Default 1 |
| limit | number | Default 30 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách thông báo thành công",
  "data": {
    "notifications": [
      {
        "id": "6601a1b2c3d4e5f6a7b8cd00",
        "userId": "6601a1b2c3d4e5f6a7b8c9d0",
        "type": "like",
        "title": "Lượt thích mới",
        "message": "Trần Thị B đã thích bài viết của bạn",
        "fromUserId": "6601a1b2c3d4e5f6a7b8c9d9",
        "relatedId": "6601a1b2c3d4e5f6a7b8ca00",
        "relatedType": "post",
        "read": false,
        "readAt": null,
        "data": {},
        "createdAt": "2024-01-15T10:05:00.000Z",
        "updatedAt": "2024-01-15T10:05:00.000Z"
      },
      {
        "type": "comment",
        "title": "Bình luận mới",
        "message": "Lê Văn C đã bình luận bài viết của bạn",
        "read": false
      },
      {
        "type": "friend_request",
        "title": "Lời mời kết bạn",
        "message": "Phạm Thị D muốn kết bạn với bạn",
        "read": true,
        "readAt": "2024-01-14T20:00:00.000Z"
      }
    ],
    "unreadCount": 5
  },
  "meta": { "pagination": { "..." } }
}
```

> **Notification types:** `comment`, `like`, `follow`, `challenge`, `achievement`, `goal`, `system`, `friend_request`

---

## 12.2 GET `/api/notifications/unread-count` — Số thông báo chưa đọc

**Auth:** ✅ Bearer Token

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy số thông báo chưa đọc thành công",
  "data": {
    "unreadCount": 5
  }
}
```

---

## 12.3 PATCH `/api/notifications/:id/read` — Đánh dấu đã đọc

**Auth:** ✅ Bearer Token

**Ví dụ:** `PATCH /api/notifications/6601a1b2c3d4e5f6a7b8cd00/read`

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Đánh dấu đã đọc thành công",
  "data": {
    "notification": {
      "id": "6601a1b2c3d4e5f6a7b8cd00",
      "read": true,
      "readAt": "2024-01-15T12:00:00.000Z"
    }
  }
}
```

**Lỗi 404:** `"Không tìm thấy thông báo"`

---

## 12.4 PATCH `/api/notifications/read-all` — Đánh dấu tất cả đã đọc

**Auth:** ✅ Bearer Token

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Đánh dấu tất cả đã đọc thành công"
}
```

---

## 12.5 DELETE `/api/notifications/:id` — Xóa thông báo

**Auth:** ✅ Bearer Token

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa thông báo thành công"
}
```

---

# 🤖 13. CHATBOT - Trò chuyện AI

## 13.1 GET `/api/chatbot/conversations` — Danh sách hội thoại

**Auth:** ✅ Bearer Token

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách hội thoại thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8ce00",
      "userId": "6601a1b2c3d4e5f6a7b8c9d0",
      "title": "Hỏi về lộ trình học IELTS",
      "preview": "Bạn nên bắt đầu với...",
      "lessonId": null,
      "skill": "general",
      "messageCount": 12,
      "lastMessageAt": "2024-01-15T11:00:00.000Z",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 13.2 GET `/api/chatbot/conversations/:conversationId/messages` — Tin nhắn

**Auth:** ✅ Bearer Token

**Ví dụ:** `GET /api/chatbot/conversations/6601a1b2c3d4e5f6a7b8ce00/messages?page=1&limit=50`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy tin nhắn thành công",
  "data": {
    "id": "6601a1b2c3d4e5f6a7b8ce00",
    "messages": [
      {
        "id": "6601a1b2c3d4e5f6a7b8ce01",
        "conversationId": "6601a1b2c3d4e5f6a7b8ce00",
        "role": "user",
        "content": "Mình muốn thi IELTS 7.0, nên bắt đầu từ đâu?",
        "data": null,
        "actions": null,
        "createdAt": "2024-01-15T09:00:00.000Z"
      },
      {
        "id": "6601a1b2c3d4e5f6a7b8ce02",
        "conversationId": "6601a1b2c3d4e5f6a7b8ce00",
        "role": "assistant",
        "content": "Chào bạn! Để đạt IELTS 7.0, mình gợi ý lộ trình sau:\n\n1. **Nền tảng (tháng 1-2):** Ôn ngữ pháp cơ bản, mở rộng từ vựng\n2. **Luyện kỹ năng (tháng 3-4):** Tập trung 4 kỹ năng\n3. **Luyện đề (tháng 5-6):** Làm đề thật, chấm điểm",
        "data": {
          "suggestions": [
            "Cho mình biết trình độ hiện tại của bạn",
            "Luyện kỹ năng nào trước?"
          ]
        },
        "actions": [
          {
            "label": "Làm bài test đầu vào",
            "icon": "📝",
            "action": "placement_test"
          },
          {
            "label": "Xem bài học Reading",
            "icon": "📖",
            "action": "view_lessons"
          }
        ],
        "createdAt": "2024-01-15T09:00:05.000Z"
      }
    ]
  }
}
```

**Lỗi 404:** `"Không tìm thấy hội thoại"`

---

## 13.3 POST `/api/chatbot/chat` — Gửi tin nhắn

**Auth:** ✅ Bearer Token

**Request Body (hội thoại mới):**

```json
{
  "message": "Làm sao để học từ vựng hiệu quả?",
  "skill": "general"
}
```

**Request Body (tiếp tục hội thoại):**

```json
{
  "conversationId": "6601a1b2c3d4e5f6a7b8ce00",
  "message": "Cảm ơn! Cho mình thêm tips về phần Listening",
  "skill": "listening"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| conversationId | string | ❌ | Để trống = tạo hội thoại mới |
| message | string | ✅ | Max 2000 ký tự |
| skill | string | ❌ | `reading` / `listening` / `writing` / `general` |
| lessonId | string | ❌ | Liên kết bài học |

**Response 201:**

```json
{
  "success": true,
  "message": "Gửi tin nhắn thành công",
  "data": {
    "id": "6601a1b2c3d4e5f6a7b8ce03",
    "conversationId": "6601a1b2c3d4e5f6a7b8ce00",
    "role": "assistant",
    "content": "Để học từ vựng hiệu quả, bạn có thể áp dụng các phương pháp sau:\n\n1. **Spaced Repetition** - Ôn lại theo chu kỳ\n2. **Context Learning** - Học từ trong ngữ cảnh\n3. **Flashcard** - Dùng thẻ ghi nhớ\n4. **Active Usage** - Sử dụng từ mới trong câu",
    "data": {
      "vocabulary": {
        "word": "effective",
        "meaning": "producing the desired result",
        "meaningVi": "hiệu quả"
      },
      "suggestions": [
        "Cho mình xem flashcard từ vựng",
        "Mình muốn chơi game từ vựng"
      ]
    },
    "actions": [
      {
        "label": "Học từ vựng",
        "icon": "📚",
        "action": "learn_vocabulary"
      }
    ],
    "createdAt": "2024-01-15T11:05:00.000Z"
  }
}
```

---

## 13.4 DELETE `/api/chatbot/conversations/:conversationId` — Xóa hội thoại

**Auth:** ✅ Bearer Token

**Ví dụ:** `DELETE /api/chatbot/conversations/6601a1b2c3d4e5f6a7b8ce00`

**Response 200:**

```json
{
  "success": true,
  "message": "Xóa hội thoại thành công"
}
```

**Lỗi 404:** `"Không tìm thấy hội thoại"`

---

# 🛡️ 14. ADMIN - Quản trị

> Tất cả endpoint admin yêu cầu `Authorization: Bearer <token>` với role admin hoặc moderator.

## 14.1 GET `/api/admin/users` — Danh sách người dùng (Admin only)

**Auth:** ✅ Bearer Token (Admin)

**Query Parameters:**

```
GET /api/admin/users?role=user&status=active&search=nguyen&page=1&limit=20
```

| Param | Type | Ghi chú |
|-------|------|---------|
| role | string | `user` / `admin` / `moderator` |
| status | string | `active` / `inactive` / `banned` / `pending` |
| search | string | Tìm theo tên/email |
| page | number | Default 1 |
| limit | number | Default 20 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách người dùng thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "name": "Nguyễn Văn A",
      "avatar": "https://...",
      "role": "user",
      "status": "active",
      "level": 10,
      "totalXp": 2500,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "6601a1b2c3d4e5f6a7b8c9d9",
      "email": "teacher@example.com",
      "name": "Trần Thị B",
      "role": "moderator",
      "status": "active",
      "level": 20,
      "totalXp": 8000,
      "createdAt": "2023-06-01T00:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 14.2 PATCH `/api/admin/users/:id/role` — Cập nhật vai trò (Admin only)

**Auth:** ✅ Bearer Token (Admin)

**Ví dụ:** `PATCH /api/admin/users/6601a1b2c3d4e5f6a7b8c9d9/role`

**Request Body:**

```json
{
  "role": "moderator"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| role | string | ✅ | `user` / `admin` / `moderator` |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật vai trò thành công",
  "data": {
    "user": { "...user cập nhật..." }
  }
}
```

**Lỗi 404:** `"Không tìm thấy người dùng"`

---

## 14.3 PATCH `/api/admin/users/:id/status` — Cập nhật trạng thái (Admin only)

**Auth:** ✅ Bearer Token (Admin)

**Ví dụ:** `PATCH /api/admin/users/6601a1b2c3d4e5f6a7b8c9d0/status`

**Request Body:**

```json
{
  "status": "banned"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| status | string | ✅ | `active` / `inactive` / `banned` / `pending` |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật trạng thái thành công",
  "data": {
    "user": { "...user cập nhật..." }
  }
}
```

---

## 14.4 GET `/api/admin/lessons` — Quản lý bài học (Teacher/Admin)

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Query Parameters:**

```
GET /api/admin/lessons?skill=reading&status=draft&createdBy=userId&page=1&limit=20
```

| Param | Type | Ghi chú |
|-------|------|---------|
| skill | string | `reading` / `listening` / `writing` |
| status | string | `draft` / `published` / `archived` |
| createdBy | string | User ID |
| page | number | Default 1 |
| limit | number | Default 20 |

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy danh sách bài học thành công",
  "data": [ "...list of lessons..." ],
  "meta": { "pagination": { "..." } }
}
```

---

## 14.5 PATCH `/api/admin/lessons/:id/status` — Duyệt/ẩn bài học (Teacher/Admin)

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Request Body:**

```json
{
  "status": "published"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| status | string | ✅ | `draft` / `published` / `archived` |

**Response 200:**

```json
{
  "success": true,
  "message": "Cập nhật trạng thái bài học thành công",
  "data": {
    "lesson": { "...lesson cập nhật..." }
  }
}
```

---

## 14.6 GET `/api/admin/flagged-posts` — Bài viết bị báo cáo (Teacher/Admin)

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Query:** `?page=1&limit=20`

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy bài viết bị báo cáo thành công",
  "data": [
    {
      "id": "6601a1b2c3d4e5f6a7b8ca00",
      "author": { "id": "...", "name": "...", "avatar": "..." },
      "content": "Nội dung bài bị báo cáo...",
      "status": "flagged",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 14.7 PATCH `/api/admin/posts/:id/moderate` — Kiểm duyệt bài viết (Teacher/Admin)

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Request Body:**

```json
{
  "action": "reject",
  "reason": "Vi phạm quy tắc cộng đồng"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| action | string | ✅ | `approve` / `reject` / `delete` |
| reason | string | ❌ | Lý do kiểm duyệt |

**Response 200:**

```json
{
  "success": true,
  "message": "Kiểm duyệt bài viết thành công",
  "data": {
    "post": { "...post sau kiểm duyệt..." }
  }
}
```

---

## 14.8 PATCH `/api/admin/comments/:id/moderate` — Kiểm duyệt bình luận (Teacher/Admin)

**Auth:** ✅ Bearer Token (Teacher/Admin)

**Request Body:**

```json
{
  "action": "delete",
  "reason": "Ngôn từ không phù hợp"
}
```

| Field | Type | Required | Ghi chú |
|-------|------|----------|---------|
| action | string | ✅ | `approve` / `reject` / `delete` |
| reason | string | ❌ | Lý do |

**Response 200:**

```json
{
  "success": true,
  "message": "Kiểm duyệt bình luận thành công"
}
```

---

## 14.9 GET `/api/admin/stats` — Thống kê hệ thống (Admin only)

**Auth:** ✅ Bearer Token (Admin)

**Request Body:** Không

**Response 200:**

```json
{
  "success": true,
  "message": "Lấy thống kê hệ thống thành công",
  "data": {
    "stats": {
      "totalUsers": 10000,
      "activeUsers": 5000,
      "totalLessons": 500,
      "publishedLessons": 450,
      "totalPosts": 25000,
      "totalChallenges": 100,
      "activeChallenges": 15,
      "totalGames": 20,
      "totalGroups": 50,
      "lastUpdate": "2024-01-15T00:00:00.000Z"
    }
  }
}
```

---

# ❤️ HEALTH CHECK

## GET `/api/health`

**Auth:** Không

**Response 200:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "env": "development"
}
```

---

## GET `/api`

**Auth:** Không

**Response 200:**

```json
{
  "name": "EngSocial API",
  "version": "0.1.0",
  "docs": "/api/health",
  "endpoints": {
    "auth": "/api/auth",
    "user": "/api/user",
    "lessons": "/api/lessons",
    "skills": "/api/skills",
    "challenges": "/api/challenges",
    "games": "/api/games",
    "community": "/api/community",
    "notifications": "/api/notifications",
    "chatbot": "/api/chatbot",
    "leaderboard": "/api/leaderboard",
    "friends": "/api/friends",
    "groups": "/api/groups"
  }
}
```

---

# 📊 TỔNG KẾT

| Module | Số API | Prefix |
|--------|--------|--------|
| Auth | 8 | `/api/auth` |
| User | 2 | `/api/user` |
| Lessons | 11 | `/api/lessons` |
| Skills | 3 | `/api/skills` |
| Daily Goals | 3 | `/api/daily-goals` |
| Challenges | 7 | `/api/challenges` |
| Games | 6 | `/api/games` |
| Leaderboard | 2 | `/api/leaderboard` |
| Community (Posts + Comments) | 9 | `/api/community` |
| Friends | 7 | `/api/friends` |
| Groups | 7 | `/api/groups` |
| Notifications | 5 | `/api/notifications` |
| Chatbot | 4 | `/api/chatbot` |
| Admin | 9 | `/api/admin` |
| Health | 2 | `/api` |
| **Tổng** | **85** | |

---

# 🔧 POSTMAN SETUP

### Environment Variables (tạo trong Postman)

| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:3000/api` |
| `access_token` | _(tự động cập nhật sau login)_ |
| `refresh_token` | _(tự động cập nhật sau login)_ |

### Headers mặc định

```
Content-Type: application/json
Accept-Language: vi
Authorization: Bearer {{access_token}}
```

### Script tự động lưu token (đặt trong tab Tests của login/register)

```javascript
if (pm.response.code === 200 || pm.response.code === 201) {
    var jsonData = pm.response.json();
    if (jsonData.data && jsonData.data.accessToken) {
        pm.environment.set("access_token", jsonData.data.accessToken);
    }
    if (jsonData.data && jsonData.data.refreshToken) {
        pm.environment.set("refresh_token", jsonData.data.refreshToken);
    }
}
```
