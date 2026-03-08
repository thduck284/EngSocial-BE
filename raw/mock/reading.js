/**
 * Raw mock: Reading filters, challenge, cards
 */
export const readingFilters = [
  { label: 'Difficulty (All)', options: ['A1 - Beginner', 'B2 - Intermediate', 'C1 - Advanced'] },
  { label: 'Topic (All)', options: ['Business', 'Science', 'Culture'] },
  { label: 'Type (All)', options: ['Short Read', 'Long Read'] },
]

export const readingChallenge = {
  title: 'Ultimate Reading Marathon',
  desc: 'Complete 5 advanced articles this week to earn 500 bonus XP and a unique badge.',
  time: '02:14:45',
  btn: 'buttons.join',
}

export const readingCards = [
  { id: 'reading-1', title: 'The Future of Sustainable Cities', level: 'B2', levelColor: 'bg-orange-500/10 text-orange-500', desc: 'Explore how urban planning is evolving to meet environmental challenges in the next decade...', topic: 'Science', time: '15m', questions: '10 Questions', rating: '8.5/10', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400' },
  { id: 'reading-2', title: 'Effective Business Emails', level: 'A2', levelColor: 'bg-green-500/10 text-green-500', desc: 'Learn the basics of formal communication and how to structure professional inquiries...', topic: 'Business', time: '10m', questions: '5 Questions', rating: '9.2/10', img: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400' },
  { id: 'reading-3', title: 'Climate Change Vocabulary', level: 'C1', levelColor: 'bg-red-500/10 text-red-500', desc: 'Advanced reading about climate science. Build your vocabulary with terms used in environmental reports...', topic: 'Science', time: '18m', questions: '15 Questions', rating: '8.6/10', img: 'https://images.unsplash.com/photo-1569163138750-1cf3f938d719?w=400' },
  { id: 'reading-4', title: 'Modern Architecture Trends', level: 'B1', levelColor: 'bg-blue-500/10 text-blue-500', desc: 'Explore sustainable design and smart buildings. Learn vocabulary about construction and urban development...', topic: 'Culture', time: '12m', questions: '8 Questions', rating: '8.0/10', img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400' },
  { id: 'reading-5', title: 'Basic Greetings and Introductions', level: 'A1', levelColor: 'bg-green-500/10 text-green-500', desc: 'Simple texts for beginners. Learn to greet, introduce yourself and ask basic questions...', topic: 'Life', time: '8m', questions: '4 Questions', rating: '9.0/10', img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400' },
  { id: 'reading-6', title: 'Travel Tips: Booking a Hotel', level: 'A2', levelColor: 'bg-green-500/10 text-green-500', desc: 'Vocabulary and phrases for hotel reservations. Practice reading emails and confirmation messages...', topic: 'Travel', time: '12m', questions: '6 Questions', rating: '8.4/10', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400' },
  { id: 'reading-7', title: 'The Impact of Remote Work', level: 'C2', levelColor: 'bg-red-500/10 text-red-500', desc: 'Advanced analysis of workplace trends. Critical reading and inference skills for proficient learners...', topic: 'Business', time: '25m', questions: '15 Questions', rating: '8.7/10', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400' },
]
