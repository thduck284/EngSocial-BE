# Lesson schema theo từng kỹ năng (Reading, Listening, Writing)

## Tổng quan

Model `Lesson` dùng chung một schema, phần nội dung theo skill nằm trong `content` và `questions`, `vocabulary`.

---

## Reading

| Trường | Mô tả | Ghi chú |
|--------|--------|---------|
| `content.text` | Nội dung bài đọc (HTML/plain) | Bắt buộc có nội dung |
| `content.wordCount` | Số từ (có thể tự tính từ `text` khi save) | Tùy chọn |
| `questions[]` | Câu hỏi đọc hiểu | multiple_choice, fill_blank, true_false, ... |
| `vocabulary[]` | Từ vựng (word, phonetic, meaning, meaningVi, example, audioUrl) | Tùy chọn |

**Đủ dùng.** Có thể bổ sung sau (tùy chọn):
- `content.difficulty` (easy/medium/hard) nếu tách khỏi level chung.

---

## Listening

| Trường | Mô tả | Ghi chú |
|--------|--------|---------|
| `content.audioUrl` | URL file audio (MP3/WAV) | Bắt buộc |
| `content.transcript` | Script / phụ đề | Nên có |
| `content.duration` | Thời lượng (giây) | Tùy chọn |
| `content.accent` | american / british / australian | Tùy chọn |
| `content.speed` | Tốc độ phát (default 1.0) | Tùy chọn |
| `content.chapters[]` | Mốc thời gian (id, label, time, startTime) | Cho seek/UI |
| `questions[]` | Câu hỏi sau khi nghe | |
| `vocabulary[]` | Từ vựng | Tùy chọn |

**Đủ dùng.** Có thể bổ sung sau (tùy chọn):
- `content.subtitleUrl` hoặc `content.subtitleFormat` (srt/vtt) nếu tách phụ đề riêng.

---

## Writing

| Trường | Mô tả | Ghi chú |
|--------|--------|---------|
| `content.prompt` | Đề bài (prompt) | Bắt buộc |
| `content.wordLimit.min` / `content.wordLimit.max` | Giới hạn từ | Nên có |
| `content.sampleAnswer` | Bài mẫu / hướng dẫn chấm | Tùy chọn |
| `questions[]` | (Ít dùng cho writing, có thể để trống) | |

**Đủ dùng.** Có thể bổ sung sau (tùy chọn):
- `content.rubric` – mảng tiêu chí chấm (criterion, maxPoints) cho chấm tự động/gợi ý.

---

## API content theo skill

| Skill | Endpoint | Controller |
|-------|----------|------------|
| Reading | `GET /api/lessons/reading/:id/content` | getReadingContent |
| Listening | `GET /api/lessons/listening/:id/content` | getListeningContent |
| Writing | `GET /api/lessons/writing/:id/content` | getWritingContent |

Cả ba đều hỗ trợ `:id` là `_id` hoặc `slug`.

---

## Khác

- **Skill (collection Skill):** có enum `reading`, `listening`, `writing`, `speaking`. Hiện tại **Lesson** chỉ có `reading` | `listening` | `writing`. Nếu sau này thêm bài học **Speaking**, cần mở rộng Lesson (ví dụ thêm `skill: 'speaking'` và `content` cho speaking).
- **UserLessonProgress:** đã có `submission: { content, wordCount, submittedAt, feedback, score }` phù hợp cho nộp bài writing và lưu tiến độ nghe (currentPosition, currentChapter).
