/**
 * Raw mock: Dashboard data (tạm - BE serve cho FE)
 */
export const mockSkillStats = [
  { icon: 'menu_book', label: 'skills.reading', value: '45m', change: '+10%', changeColor: 'text-green-500', to: '/skills/reading' },
  { icon: 'headset', label: 'skills.listening', value: '1h 20m', change: '-5%', changeColor: 'text-red-500', to: '/skills/listening' },
  { icon: 'edit_note', label: 'skills.writing', value: '30m', change: '+20%', changeColor: 'text-green-500', to: '/skills/writing' },
]

export const mockFeaturedLessons = [
  { title: 'Đọc hiểu: Sustainable Cities', icon: 'menu_book', skill: 'Reading', level: 'INTERMEDIATE', to: '/lessons?skill=reading', learners: '1.8K' },
  { title: 'Podcast: Global Tech Trends', icon: 'headset', skill: 'Listening', level: 'INTERMEDIATE', to: '/lessons?skill=listening', learners: '2.1K' },
  { title: '10 Idioms cho công sở', icon: 'edit_note', skill: 'Writing', level: 'INTERMEDIATE', to: '/lessons?skill=writing', learners: '1.2K' },
]

export const mockGoals = [
  { done: true, labelKey: 'profile.goalCompleteLessons' },
  { done: true, labelKey: 'profile.goalReadArticle' },
  { done: false, labelKey: 'profile.goalWritingWords' },
]

export const mockSuggestedGroups = [
  { icon: 'translate', title: 'IELTS Speaking Practice', members: '12.4K thành viên', color: 'bg-indigo-500' },
  { icon: 'movie', title: 'Học Tiếng Anh Qua Phim', members: '8.2K thành viên', color: 'bg-emerald-500' },
]

export const mockLeaderboard = [
  { rank: 1, name: 'Minh Anh', xp: 2450, highlight: true },
  { rank: 2, name: 'David H.', xp: 2280, highlight: false },
  { rank: 3, name: 'Sophie C.', xp: 2100, highlight: false },
]

export const mockFriendSuggestions = [
  { name: 'Alex Thompson', avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson', mutualFriends: 8 },
]

export const mockUserProfile = {
  name: 'John Doe',
  level: 15,
  xp: 350,
  xpMax: 500,
  avatar: 'https://ui-avatars.com/api/?name=John+Doe',
}

export const mockProfileFriends = [
  { name: 'Alex Nguyen', level: 'Level 24', avatar: 'https://ui-avatars.com/api/?name=Alex', online: true },
  { name: 'Sophie Tran', level: 'Level 18', avatar: 'https://ui-avatars.com/api/?name=Sophie', online: true },
  { name: 'Minh Hoang', level: 'Level 30', avatar: 'https://ui-avatars.com/api/?name=Minh', online: true },
  { name: 'Elena Smith', level: 'Level 12', avatar: 'https://ui-avatars.com/api/?name=Elena', online: true },
  { name: 'Tuan Anh', level: 'Offline', avatar: 'https://ui-avatars.com/api/?name=Tuan', online: false },
]

export const mockProfileSkillStats = [
  { icon: 'menu_book', labelKey: 'skills.reading', xp: '1,240 XP', iconColor: 'text-blue-500' },
  { icon: 'headset', labelKey: 'skills.listening', xp: '850 XP', iconColor: 'text-orange-500' },
  { icon: 'edit_note', labelKey: 'skills.writing', xp: '420 XP', iconColor: 'text-green-500' },
]

export const mockProfileAchievements = [
  { icon: 'workspace_premium', title: 'Top Learner', date: 'Nov 2023', bgClass: 'bg-orange-500/10 border-orange-500/20', textClass: 'text-orange-400', iconBg: 'bg-orange-500' },
  { icon: 'auto_graph', title: 'Skill Master', date: 'B2 Level', bgClass: 'bg-cyan-500/10 border-cyan-500/20', textClass: 'text-cyan-400', iconBg: 'bg-cyan-500' },
]
