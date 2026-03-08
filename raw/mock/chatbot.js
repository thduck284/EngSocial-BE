/**
 * Raw mock: Chatbot
 */
export const mockConversations = [
  { id: '1', preview: 'Giải thích từ "Sustainability"...', time: '10:42 AM', active: true },
  { id: '2', preview: 'Cấu trúc câu điều kiện loại 2', time: 'Hôm qua', active: false },
  { id: '3', preview: 'Bài tập Unit 5: Climate', time: '2 ngày trước', active: false },
  { id: '4', preview: 'Luyện nghe B2 - Podcast', time: '3 ngày trước', active: false },
  { id: '5', preview: 'Từ vựng chủ đề Business', time: '1 tuần trước', active: false },
]

export const mockChatMessages = [
  { id: 1, type: 'ai', text: 'Chào! Mình là trợ lý học tập EngSocial. Bạn cần mình giải thích cấu trúc ngữ pháp nào không?' },
  { id: 2, type: 'user', text: 'Giải thích giúp mình từ "Sustainability" trong ngữ cảnh này với.', time: '10:42 AM' },
  { id: 3, type: 'ai', text: 'Sustainability - Sự bền vững. Trong ngữ cảnh bài đọc "Climate".', actions: [{ label: 'Dịch câu này', icon: 'translate' }, { label: 'Giải thích ngữ pháp', icon: 'menu_book' }, { label: 'Tìm bài tập', icon: 'quiz' }] },
]
