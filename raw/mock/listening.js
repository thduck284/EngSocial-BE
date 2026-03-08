/**
 * Raw mock: Listening filters, challenge, cards
 */
export const listeningFilters = [
  { label: 'Difficulty (All)', options: ['A1 - Beginner', 'B2 - Intermediate', 'C1 - Advanced'] },
  { label: 'Topic (All)', options: ['Technology', 'News', 'Business', 'Entertainment'] },
  { label: 'Accent (All)', options: ['American', 'British', 'Australian'] },
  { label: 'Speed (Normal)', options: ['0.75x', '1.25x', '1.5x'] },
]

export const listeningChallenge = {
  title: 'Listening Mastery: Daily Podcasts',
  desc: 'Listen to 7 podcasts this week and answer all questions to unlock the "Audio Explorer" badge & 800 XP.',
  time: '05:22:10',
  btn: 'buttons.joinChallenge',
  icon: 'equalizer',
}

export const listeningCards = [
  { id: 'listening-1', title: 'Global Tech Trends Podcast', level: 'B2', levelColor: 'bg-orange-500/10 text-orange-500', accent: 'American Accent', accentClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Stay updated with the latest technological advancements and how they impact our global economy...', topic: 'Technology', time: '12m', questions: '8 Questions', rating: '8.2/10', img: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400' },
  { id: 'listening-2', title: 'BBC News Highlights', level: 'C1', levelColor: 'bg-red-500/10 text-red-500', accent: 'British Accent', accentClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', desc: 'A quick summary of the most important world news events reported by expert correspondents...', topic: 'News', time: '5m', questions: '10 Questions', rating: '9.0/10', img: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400' },
  { id: 'listening-3', title: 'British vs American Accents', level: 'B1', levelColor: 'bg-blue-500/10 text-blue-500', accent: 'Mixed', accentClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20', desc: 'Improve your listening by comparing British and American pronunciation with native speakers...', topic: 'Culture', time: '20m', questions: '8 Questions', rating: '8.8/10', img: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400' },
  { id: 'listening-4', title: "TED Talk: The Power of Introverts", level: 'B2', levelColor: 'bg-orange-500/10 text-orange-500', accent: 'American Accent', accentClass: 'bg-primary/10 text-primary border-primary/20', desc: "Listen to Susan Cain's famous TED Talk. Practice comprehension with authentic spoken English...", topic: 'Psychology', time: '25m', questions: '12 Questions', rating: '9.0/10', img: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=400' },
  { id: 'listening-5', title: 'Simple Daily Conversations', level: 'A1', levelColor: 'bg-green-500/10 text-green-500', accent: 'American Accent', accentClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Basic dialogues: shopping, ordering food, asking for directions. Slow, clear pronunciation...', topic: 'Life', time: '10m', questions: '5 Questions', rating: '9.1/10', img: 'https://images.unsplash.com/photo-1579869847514-7c1a19d2d2ad?w=400' },
  { id: 'listening-6', title: 'Movie Reviews Podcast', level: 'A2', levelColor: 'bg-green-500/10 text-green-500', accent: 'British Accent', accentClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', desc: 'Light entertainment. Listen to short film reviews and practice understanding opinions...', topic: 'Entertainment', time: '8m', questions: '4 Questions', rating: '8.2/10', img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400' },
  { id: 'listening-7', title: 'University Lecture: History of AI', level: 'C1', levelColor: 'bg-red-500/10 text-red-500', accent: 'American Accent', accentClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Academic listening. Follow a university lecture on artificial intelligence development...', topic: 'Education', time: '30m', questions: '15 Questions', rating: '8.5/10', img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400' },
]
