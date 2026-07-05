# EngSocial-BE

Backend API cho nền tảng học tiếng Anh xã hội **EngSocial** — quản lý người dùng, bài học/luyện tập, cộng đồng, gamification, chatbot AI và game realtime.

## Tech stack

| Thành phần | Công nghệ |
|------------|-----------|
| Runtime | Node.js 18+ (ES Modules) |
| Framework | Express.js |
| Database | MongoDB Atlas (Mongoose) |
| Realtime | Socket.IO |
| Auth | JWT, Google/Facebook OAuth |
| Upload | Cloudinary |
| Email | Nodemaily (SMTP) |
| Search (tuỳ chọn) | Elasticsearch |
| HTTP client (chatbot) | undici |

## Kiến trúc tích hợp

Backend này là **API trung tâm**. Một số tính năng AI chạy ở service riêng:

```text
Frontend (localhost / Vercel / Render)
        │
        ▼
EngSocial-BE  ──► MongoDB Atlas
        │
        ├── CHAT_BOT_APP (ngrok) ──► Flask chatbot trên Kaggle (test.py)
        ├── AI_MATCHMAKING_URL ──► ai-matching-game (Render)
        └── MODERATION_APP ──► AI kiểm duyệt nội dung (ngrok/Render)
```

> **Lưu ý:** Chatbot **không** chạy trong repo BE. BE chỉ **proxy** request tới Flask qua biến `CHAT_BOT_APP`.

## Yêu cầu

- Node.js >= 18
- MongoDB Atlas (hoặc MongoDB local)
- Tài khoản Cloudinary (upload ảnh)
- (Tuỳ chọn) Flask chatbot + ngrok cho tính năng chat AI

## Cài đặt local

```bash
cd EngSocial-BE
npm install

# Tạo file .env (xem mục Environment bên dưới)

npm run dev
```

Server mặc định: `http://localhost:5000`

Kiểm tra nhanh:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/db
```

## Environment variables

Tạo file `.env` ở thư mục gốc `EngSocial-BE/`. **Không commit** file này.

### Bắt buộc

| Biến | Mô tả |
|------|--------|
| `MONGODB_URI` | Connection string MongoDB Atlas |
| `DB_NAME` | Tên database (vd: `engsocial`) |
| `JWT_SECRET` | Secret ký JWT |
| `JWT_EXPIRES_IN` | Thời hạn access token (vd: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Thời hạn refresh token (vd: `7d`) |
| `CORS_ORIGIN` | Origin FE, phân cách bằng dấu phẩy |

### Chatbot AI

| Biến | Mô tả |
|------|--------|
| `CHAT_BOT_APP` | **Origin** ngrok tới Flask, vd: `https://xxxx.ngrok-free.app` (không kèm `/api/chat/stream`) |
| `CHAT_BOT_TLS_INSECURE` | `1` — bắt buộc khi gọi ngrok từ Node/Render (tránh lỗi SSL) |

BE gọi endpoint Flask: `{CHAT_BOT_APP}/api/chat/stream`

### Dịch vụ AI / bên thứ ba

| Biến | Mô tả |
|------|--------|
| `AI_MATCHMAKING_URL` | URL matchmaking game (vd: Render) |
| `AI_MATCHMAKING_INTERNAL_URL` | (Tuỳ chọn) Proxy `/api/matchmake` nội bộ |
| `MODERATION_APP` | URL API kiểm duyệt bài viết |
| `GEMINI_API_KEY` | Google Gemini (nếu dùng) |
| `CLOUDINARY_*` | Cloud name, API key, secret |
| `GOOGLE_CLIENT_ID` | Đăng nhập Google |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Đăng nhập Facebook |
| `SMTP_*` | Gửi email qua nodemailer (quên mật khẩu, OTP, đổi status) |
| `SMTP_USER` | (Tuỳ chọn) User đăng nhập SMTP; mặc định = `SMTP_FROM` |
| `ELASTICSEARCH_NODE` | (Tuỳ chọn) Tìm kiếm user |

### Server

| Biến | Mô tả |
|------|--------|
| `PORT` | Cổng HTTP (mặc định `5000`) |
| `NODE_ENV` | `development` / `production` |

## Scripts

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Chạy dev với `--watch` |
| `npm start` | Chạy production |
| `npm run db:schema` | Chạy schema MongoDB (cần `mongosh`) |
| `npm run db:seed` | Seed cơ bản qua mongosh |
| `npm run db:seed:all` | Seed lessons, quests, challenges (Node) |
| `npm run db:seed:lessons` | Seed bài học |
| `npm run db:seed:reading` | Seed bài reading |
| `npm run db:seed:writing` | Seed bài writing |
| `npm run db:seed:quests` | Seed quest |
| `npm run db:seed:challenges` | Seed thử thách |

## Cấu trúc thư mục

```text
EngSocial-BE/
├── src/
│   ├── server.js           # Entry: HTTP + Socket.IO
│   ├── app.js              # Express, CORS, health, proxy matchmake
│   ├── config/             # DB, socket, loadEnv
│   ├── routes/             # auth, user, learning, social, gamification, system
│   ├── controllers/
│   ├── services/           # chatbot, lesson, auth, moderation, ...
│   ├── models/
│   ├── middlewares/        # auth, validate, locale, error
│   ├── validators/
│   ├── sockets/            # Word Scramble, Snake game lobby
│   ├── dto/
│   └── locales/
├── package.json
└── .env                    # Local only — không push lên git
```

## API chính

Base URL: `/api`

| Nhóm | Prefix | Ghi chú |
|------|--------|---------|
| Health | `GET /api/health`, `GET /api/health/db` | Không cần auth |
| Auth | `/api/auth` | Đăng ký, đăng nhập, refresh token |
| User | `/api/user` | Hồ sơ, cài đặt |
| Lessons | `/api/lessons` | Bài học published |
| Practices | `/api/practices` | Bài luyện tập |
| Skills / Vocabulary | `/api/skills`, `/api/vocabulary` | Kỹ năng, từ vựng gần đây |
| Mock tests | `/api/mock-tests` | Bài test mẫu |
| Word Scramble | `/api/word-scramble` | Game xếp chữ |
| Community | `/api/community` | Bài viết, bình luận |
| Friends / Groups | `/api/friends`, `/api/groups` | Bạn bè, nhóm |
| Gamification | `/api/challenges`, `/api/quests`, `/api/leaderboard` | Quest, thử thách, BXH |
| Chatbot | `/api/chatbot` | Hội thoại AI (cần JWT) |
| Notifications | `/api/notifications` | Thông báo |
| Admin | `/api/admin` | Quản trị |
| Upload | `/api/upload` | Upload media (Cloudinary) |

Danh sách đầy đủ: `GET /api`

### Chatbot (stream)

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/chatbot/chat/stream` | Bearer JWT |
| `POST` | `/api/chatbot/chat` | Bearer JWT |
| `GET` | `/api/chatbot/conversations` | Bearer JWT |
| `GET` | `/api/chatbot/conversations/:id/messages` | Bearer JWT |
| `DELETE` | `/api/chatbot/conversations/:id` | Bearer JWT |

Response stream: dòng đầu JSON `meta`, phần còn lại là text/plain từ Flask chatbot.

Body mẫu:

```json
{
  "message": "Gợi ý bài học du lịch",
  "conversationId": "optional-mongo-id",
  "replyLanguage": "vi"
}
```

## Deploy lên Render

1. Kết nối repo GitHub với Render Web Service.
2. **Build command:** `npm install`
3. **Start command:** `npm start`
4. Thêm **Environment Variables** (giống `.env`, không dùng file `.env` trên cloud). **Bắt buộc thêm `GEMINI_API_KEY`** nếu dùng chấm Writing bằng AI (`POST /api/lessons/:id/ai-grade/:userId`).
5. **Email trên Render free:** Render [chặn outbound SMTP port 587/465](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports) — Gmail SMTP sẽ `Connection timeout`. Dùng **Brevo SMTP relay port 2525** (vẫn nodemailer, free ~300 email/ngày):

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_USER=email-dang-ky-brevo@gmail.com
SMTP_PASS=xsmtpsib-xxxxxxxx
SMTP_FROM=email-sender-da-verify@gmail.com
SMTP_TLS_INSECURE=1
```

Lấy `SMTP_PASS` tại Brevo → **SMTP & API → SMTP keys**. Verify sender email trong **Senders & IP**. Local dev vẫn dùng Gmail port 587 bình thường.

6. Bắt buộc cho chatbot trên Render:

```env
GEMINI_API_KEY=your-google-ai-studio-key
CHAT_BOT_APP=https://YOUR-NGROK-URL.ngrok-free.app
CHAT_BOT_TLS_INSECURE=1
CORS_ORIGIN=https://your-frontend.onrender.com,http://localhost:3000
```

7. **Manual Deploy** sau mỗi lần đổi env hoặc code.

### Chatbot trên production — checklist

1. Kaggle notebook chạy `test.py`, log có `[ngrok] Tunnel URL: ...`
2. Copy URL ngrok mới vào `CHAT_BOT_APP` trên Render (URL đổi mỗi lần restart kernel)
3. BE đã deploy bản mới (`undici` + `chatbot.service.js` xử lý SSL ngrok)
4. Test tunnel:

```bash
curl -sk -H "ngrok-skip-browser-warning: 69420" https://YOUR-URL.ngrok-free.app/api/health
```

Kết quả mong đợi: `{"ok":true}`

## Xử lý sự cố chatbot

| Log / triệu chứng | Nguyên nhân | Cách xử lý |
|-------------------|-------------|------------|
| `fetch failed — UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Node không tin cert ngrok | `CHAT_BOT_TLS_INSECURE=1`, redeploy BE |
| `UND_ERR_INVALID_ARG` | Lệch version undici/fetch | Deploy BE mới (dùng `undici.fetch`) |
| `fetch failed` (không chi tiết) | Tunnel tắt / URL cũ | Bật lại Kaggle, cập nhật `CHAT_BOT_APP` |
| Chat trả fallback “Không kết nối được chat server” | BE không gọi được Flask | Kiểm tra 4 bước checklist trên |

Log BE: tìm dòng `[chatbot] CHAT_BOT_APP failed: ...`

## Socket.IO

Server khởi tạo Socket.IO cùng cổng HTTP — dùng cho lobby/game realtime (Word Scramble, Snake). FE kết nối tới cùng origin API (bỏ `/api`).

## License

MIT
