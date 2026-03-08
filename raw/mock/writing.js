/**
 * Raw mock: Writing filters, challenge, cards
 */
export const writingFilters = [
  { label: 'Difficulty (All)', options: ['A1', 'A2', 'B1', 'B2', 'C1'] },
  { label: 'Topic (All)', options: ['Business', 'Travel', 'Technology', 'Education', 'Life'] },
  { label: 'Type (All)', options: ['Essay', 'Email', 'Story', 'Report'] },
  { label: 'Length (All)', options: ['Short', 'Medium', 'Long'] },
]

export const writingChallenge = {
  title: 'Writing Challenge: The Future of AI',
  desc: 'Write a 300-word essay on how AI impacts education. Reward: 1000 XP & "Future Thinker" Badge.',
  time: '03:15:45',
  btn: 'buttons.joinChallenge',
  icon: 'edit_square',
}

export const writingCards = [
  { id: 'writing-1', title: 'Professional Email Request', level: 'B1', levelColor: 'bg-blue-500/10 text-blue-500', type: 'Email Practice', typeClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Compose a formal request to a manager regarding a schedule change for next month...', topic: 'Business', length: '100-150 words', time: '30 min', rating: '8.5/10', img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400' },
  { id: 'writing-2', title: 'Travel Blog Entry', level: 'A2', levelColor: 'bg-orange-500/10 text-orange-500', type: 'Storytelling', typeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', desc: 'Describe your last vacation and what you enjoyed most about the destination...', topic: 'Travel', length: '150-200 words', time: '45 min', rating: '7.9/10', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
  { id: 'writing-3', title: 'Writing a Formal Letter', level: 'A2', levelColor: 'bg-green-500/10 text-green-500', type: 'Formal Letter', typeClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Master the structure and tone of formal letters. Learn greetings, closings, and proper formatting...', topic: 'Business', length: '100-150 words', time: '20 min', rating: '8.3/10', img: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400' },
  { id: 'writing-4', title: 'Opinion Essay: Social Media', level: 'B2', levelColor: 'bg-orange-500/10 text-orange-500', type: 'Essay', typeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', desc: 'Write an essay expressing your views on the impact of social media on society...', topic: 'Technology', length: '250-300 words', time: '50 min', rating: '8.1/10', img: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400' },
  { id: 'writing-5', title: 'Introduce Yourself', level: 'A1', levelColor: 'bg-green-500/10 text-green-500', type: 'Short Paragraph', typeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', desc: 'Write 3-5 sentences about yourself: name, age, hobbies. Perfect for absolute beginners...', topic: 'Life', length: '50-80 words', time: '15 min', rating: '9.0/10', img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400' },
  { id: 'writing-6', title: 'Describe Your Favorite Place', level: 'A2', levelColor: 'bg-green-500/10 text-green-500', type: 'Description', typeClass: 'bg-primary/10 text-primary border-primary/20', desc: 'Describe a place you love: a park, beach, or your room. Use simple adjectives and prepositions...', topic: 'Travel', length: '80-120 words', time: '25 min', rating: '8.0/10', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
  { id: 'writing-7', title: 'Academic Report: Environmental Issues', level: 'C1', levelColor: 'bg-red-500/10 text-red-500', type: 'Report', typeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', desc: 'Write a structured report on an environmental topic. Formal style, data, and recommendations...', topic: 'Science', length: '400-500 words', time: '60 min', rating: '8.4/10', img: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400' },
]
