# EngSocial-BE

Backend API cho nền tảng học tiếng Anh EngSocial.

## 🚀 Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB Atlas
- **ORM:** Mongoose

## 📦 Setup

```bash
# Install dependencies
npm install

# Edit environment
# Set required variables in `.env` (for example: MONGODB_URI)

# Run schema & seed (see database/README.md)
# Then start server
npm run dev
```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (with watch) |
| `npm start` | Start production server |
| `npm run db:schema` | Run MongoDB schema (requires MONGODB_URI) |
| `npm run db:seed` | Run seed data (mongosh) |
| `npm run db:seed:all` | Seed lessons + practices + quests (Node, dùng cho Atlas) |

## 📁 Project Structure

```
EngSocial-BE/
├── database/           # MongoDB schema & seed
│   ├── mongodb-schema.js
│   ├── seed-data.js
│   └── README.md
├── src/
│   ├── config/         # DB config
│   ├── app.js          # Express app
│   └── server.js       # Entry point
├── .env
└── package.json
```

## 🔗 API Endpoints

- `GET /api` - API info
- `GET /api/health` - Health check