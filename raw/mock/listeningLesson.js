/**
 * Raw mock: Listening lesson detail (chapters, quiz, vocab, leaderboard)
 */
export const mockLessonChapters = [
  { id: 'intro', label: 'Introduction', time: '0:00', done: true, active: false },
  { id: 'main', label: 'Main Argument', time: '2:45', done: false, active: true },
  { id: 'case', label: 'Case Studies', time: '6:12', done: false, active: false },
  { id: 'conclusion', label: 'Conclusion', time: '11:30', done: false, active: false },
]

export const mockQuizOptions = [
  { value: 'a', text: 'The historical impact of the industrial revolution on modern automation.' },
  { value: 'b', text: 'Recent advancements in artificial intelligence and their ethical implications.', correct: true },
  { value: 'c', text: 'A detailed review of the latest consumer smartphones released this quarter.' },
  { value: 'd', text: 'Financial analysis of global tech market fluctuations in early 2024.' },
]

export const mockVocabCard = {
  word: 'Implication',
  phonetic: '/ˌɪmplɪˈkeɪʃn/',
  meaning: "The conclusion that can be drawn from something although it is not explicitly stated.",
  progress: '3 / 12',
}

export const mockLessonLeaderboard = [
  { rank: 1, name: 'Alex Thompson', xp: '2,450 XP', xpColor: 'text-amber-600', border: 'border-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  { rank: 2, name: 'Sophie Chen', xp: '2,210 XP', xpColor: 'text-slate-500', border: 'border-slate-300 dark:border-slate-600', bg: '' },
  { rank: 3, name: 'John Doe', xp: '1,980 XP', xpColor: 'text-slate-500', border: 'border-orange-400/50', bg: '' },
]
