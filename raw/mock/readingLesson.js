/**
 * Raw mock: Reading lesson detail (vocab, questions, content, leaderboard)
 */
export const mockReadingVocab = {
  word: 'Etiquette',
  phonetic: '/ˈetɪket/',
  partOfSpeech: 'danh từ',
  meaning: 'Phép xã giao, quy tắc ứng xử giữa mọi người trong một tổ chức hoặc xã hội.',
  example: 'Learning local etiquette is important before traveling.',
  progress: '1/5',
}

export const mockReadingQuestions = [
  {
    id: 1,
    question: 'Theo nội dung bài đọc, tại sao "Subject Line" lại quan trọng nhất trong một email công việc?',
    options: [
      { value: 'a', text: 'Nó làm cho email trông đẹp hơn và chuyên nghiệp hơn.' },
      { value: 'b', text: 'Nó là ấn tượng đầu tiên và giúp người nhận phân loại ưu tiên.', correct: true },
      { value: 'c', text: 'Nó bắt buộc phải có để email có thể gửi đi được.' },
      { value: 'd', text: 'Giúp tránh được các bộ lọc thư rác (spam).' },
    ],
  },
]

export const mockReadingContent = {
  title: 'Mastering Business English: Email Etiquette',
  level: 'B2',
  topic: 'Professional Communication',
  time: '15-20 phút',
  questions: 10,
  xpReward: 150,
  progress: 40,
  thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400',
  text: `In today's digital age, the way we communicate through email has become a cornerstone of professional success. Effective email etiquette is no longer just a courtesy; it's a vital business skill that can influence career progression and business relationships.

First and foremost, the subject line is your email's first impression. It should be concise and descriptive. Avoid vague titles like "Hello" or "Checking in." Instead, use specific headers like "Q3 Marketing Report - Action Required" to help recipients prioritize their inbox.

Furthermore, maintaining a professional tone is essential. While internal emails can be more casual, external communication requires a balance of warmth and formality. Use appropriate greetings and ensure your message is clear, avoiding excessive jargon or emojis that might lead to misinterpretation.

Finally, always proofread before hitting send. Grammatical errors or misspelled names can undermine your credibility. A well-crafted email reflects attention to detail and respect for the recipient's time.`,
  highlightedWords: [
    { word: 'Effective', start: 0, end: 9 },
    { word: 'prioritize', start: 0, end: 10 },
    { word: 'misinterpretation', start: 0, end: 17 },
  ],
}

export const mockReadingLeaderboard = [
  { rank: 1, name: 'Minh Anh', level: 'Level 24 Learner', xp: '2,450', avatar: 'https://ui-avatars.com/api/?name=Minh+Anh' },
  { rank: 2, name: 'David H.', level: 'Level 21 Learner', xp: '2,120', avatar: 'https://ui-avatars.com/api/?name=David+H' },
  { rank: 3, name: 'Thảo Vy', level: 'Level 19 Learner', xp: '1,980', avatar: 'https://ui-avatars.com/api/?name=Thao+Vy' },
]
