/**
 * Seed 15 lessons (category: 'lesson') for /lessons page.
 * Run: node database/seed-lessons.js
 * Requires MONGODB_URI in .env
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import Lesson from '../src/models/learning/Lesson.js'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env')
  process.exit(1)
}

const lessons = [
  {
    title: 'Greetings and introductions (A1)',
    slug: 'lesson-reading-a1-greetings',
    skill: 'reading',
    level: 'A1',
    category: 'lesson',
    topic: 'Life',
    description: 'Learn how to greet people and introduce yourself in English.',
    thumbnail: '',
    content: { text: `When you meet someone for the first time, you can say "Hello" or "Hi". To introduce yourself, say "My name is..." and "Nice to meet you." In formal situations use "How do you do?" or "Pleased to meet you."` },
    vocabulary: [{ word: 'greet', meaning: 'chào hỏi' }, { word: 'introduce', meaning: 'giới thiệu' }],
    questions: [
      { question: 'What can you say when you meet someone?', type: 'multiple_choice', options: [{ value: 'A', text: 'Hello or Hi' }, { value: 'B', text: 'Goodbye' }, { value: 'C', text: 'Thank you' }], correctAnswer: 'A', explanation: 'You can say "Hello" or "Hi".', points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    status: 'published',
    order: 1,
  },
  {
    title: 'Numbers and colours (A1)',
    slug: 'lesson-reading-a1-numbers-colours',
    skill: 'reading',
    level: 'A1',
    category: 'lesson',
    topic: 'Education',
    description: 'Practice numbers 1–20 and basic colour words.',
    thumbnail: '',
    content: { text: `Numbers from 1 to 10: one, two, three, four, five, six, seven, eight, nine, ten. Colours: red, blue, green, yellow, black, white. We use "What colour is it?" to ask about colour.` },
    vocabulary: [{ word: 'colour', meaning: 'màu sắc' }, { word: 'number', meaning: 'số' }],
    questions: [
      { question: 'How do you ask about colour?', type: 'multiple_choice', options: [{ value: 'A', text: 'What colour is it?' }, { value: 'B', text: 'How many?' }, { value: 'C', text: 'Where is it?' }], correctAnswer: 'A', explanation: 'We use "What colour is it?" to ask about colour.', points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    status: 'published',
    order: 2,
  },
  {
    title: 'At the café (A1 Reading)',
    slug: 'lesson-reading-a1-at-the-cafe',
    skill: 'reading',
    level: 'A1',
    category: 'lesson',
    topic: 'Life',
    description: 'Read a short dialogue at a café and learn useful phrases.',
    thumbnail: '',
    content: { text: `Waiter: Good morning. What would you like? Customer: I'd like a coffee, please. Waiter: Small, medium or large? Customer: Medium, please. Waiter: Anything else? Customer: No, thank you. Waiter: That's £3.50, please.` },
    vocabulary: [{ word: 'waiter', meaning: 'phục vụ' }, { word: 'order', meaning: 'gọi món' }],
    questions: [
      { question: 'What did the customer order?', type: 'multiple_choice', options: [{ value: 'A', text: 'Tea' }, { value: 'B', text: 'Coffee' }, { value: 'C', text: 'Juice' }], correctAnswer: 'B', explanation: "Customer: I'd like a coffee, please.", points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    status: 'published',
    order: 3,
  },
  {
    title: 'Daily routine (A2 Reading)',
    slug: 'lesson-reading-a2-daily-routine',
    skill: 'reading',
    level: 'A2',
    category: 'lesson',
    topic: 'Life',
    description: 'Read about a typical day and learn routine vocabulary.',
    thumbnail: '',
    content: { text: `I get up at 7 a.m. I have breakfast at half past seven. I go to work by bus. I start work at 9 a.m. and finish at 5 p.m. In the evening I cook dinner and watch TV. I go to bed at 11 p.m.` },
    vocabulary: [{ word: 'routine', meaning: 'thói quen hàng ngày' }, { word: 'commute', meaning: 'đi lại' }],
    questions: [
      { question: 'What time does the person start work?', type: 'multiple_choice', options: [{ value: 'A', text: '7 a.m.' }, { value: 'B', text: '9 a.m.' }, { value: 'C', text: '5 p.m.' }], correctAnswer: 'B', explanation: 'I start work at 9 a.m.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 40,
    status: 'published',
    order: 4,
  },
  {
    title: 'Weather and seasons (A2 Reading)',
    slug: 'lesson-reading-a2-weather',
    skill: 'reading',
    level: 'A2',
    category: 'lesson',
    topic: 'Life',
    description: 'Learn vocabulary for weather and the four seasons.',
    thumbnail: '',
    content: { text: `In spring it is often rainy and mild. In summer it is hot and sunny. In autumn the leaves fall and it gets cooler. In winter it can be cold and snowy. We say "What's the weather like?" to ask about the weather.` },
    vocabulary: [{ word: 'mild', meaning: 'ôn hòa' }, { word: 'season', meaning: 'mùa' }],
    questions: [
      { question: 'Which season is hot and sunny?', type: 'multiple_choice', options: [{ value: 'A', text: 'Spring' }, { value: 'B', text: 'Summer' }, { value: 'C', text: 'Winter' }], correctAnswer: 'B', explanation: 'In summer it is hot and sunny.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 40,
    status: 'published',
    order: 5,
  },
  {
    title: 'Voicemail message (A1 Listening)',
    slug: 'lesson-listening-a1-voicemail',
    skill: 'listening',
    level: 'A1',
    category: 'lesson',
    topic: 'Business',
    description: 'Listen to a short voicemail and understand the message.',
    thumbnail: '',
    content: {
      transcript: `John: Hi, this is John. Thanks for calling. I'm not here at the moment, so please leave a message and I'll call you back.`,
      duration: 15,
      accent: 'british',
    },
    vocabulary: [{ word: 'voicemail', meaning: 'thư thoại' }, { word: 'message', meaning: 'tin nhắn' }],
    questions: [
      { question: 'What should the caller do?', type: 'multiple_choice', options: [{ value: 'A', text: 'Call again later' }, { value: 'B', text: 'Leave a message' }, { value: 'C', text: 'Send an email' }], correctAnswer: 'B', explanation: 'Please leave a message and I will call you back.', points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    time: '5m',
    status: 'published',
    order: 6,
  },
  {
    title: 'Checking in at the airport (A2 Listening)',
    slug: 'lesson-listening-a2-airport',
    skill: 'listening',
    level: 'A2',
    category: 'lesson',
    topic: 'Travel',
    description: 'Listen to a dialogue at the airport check-in desk.',
    thumbnail: '',
    content: {
      transcript: `Agent: Good morning. Can I see your passport and ticket, please? Passenger: Here you are. Agent: Would you like a window or aisle seat? Passenger: Window, please. Agent: Here's your boarding pass. Gate 12, boarding at 10.30. Have a good flight!`,
      duration: 45,
      accent: 'british',
    },
    vocabulary: [{ word: 'boarding pass', meaning: 'thẻ lên máy bay' }, { word: 'aisle', meaning: 'lối đi' }],
    questions: [
      { question: 'What did the passenger choose?', type: 'multiple_choice', options: [{ value: 'A', text: 'Aisle seat' }, { value: 'B', text: 'Window seat' }, { value: 'C', text: 'Middle seat' }], correctAnswer: 'B', explanation: 'Passenger: Window, please.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 40,
    time: '6m',
    status: 'published',
    order: 7,
  },
  {
    title: 'Ordering food (A1 Listening)',
    slug: 'lesson-listening-a1-ordering-food',
    skill: 'listening',
    level: 'A1',
    category: 'lesson',
    topic: 'Life',
    description: 'Listen to someone ordering food in a restaurant.',
    thumbnail: '',
    content: {
      transcript: `Waiter: Are you ready to order? Customer: Yes. I'll have the soup to start, and then the chicken, please. Waiter: Would you like rice or potatoes? Customer: Rice, please. Waiter: And to drink? Customer: Just water, thank you.`,
      duration: 30,
      accent: 'british',
    },
    vocabulary: [{ word: 'order', meaning: 'gọi món' }, { word: 'starter', meaning: 'món khai vị' }],
    questions: [
      { question: 'What did the customer order to start?', type: 'multiple_choice', options: [{ value: 'A', text: 'Salad' }, { value: 'B', text: 'Soup' }, { value: 'C', text: 'Bread' }], correctAnswer: 'B', explanation: "I'll have the soup to start.", points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    time: '5m',
    status: 'published',
    order: 8,
  },
  {
    title: 'News report – weather (B1 Listening)',
    slug: 'lesson-listening-b1-weather-news',
    skill: 'listening',
    level: 'B1',
    category: 'lesson',
    topic: 'News',
    description: 'Listen to a short weather forecast.',
    thumbnail: '',
    content: {
      transcript: `And now the weather. Tomorrow will be cloudy in the morning with some rain in the north. By the afternoon the sun will come out in the south. Temperatures will be between 12 and 16 degrees. Have a good day!`,
      duration: 25,
      accent: 'british',
    },
    vocabulary: [{ word: 'forecast', meaning: 'dự báo' }, { word: 'cloudy', meaning: 'nhiều mây' }],
    questions: [
      { question: 'Where will there be rain tomorrow?', type: 'multiple_choice', options: [{ value: 'A', text: 'In the south' }, { value: 'B', text: 'In the north' }, { value: 'C', text: 'Everywhere' }], correctAnswer: 'B', explanation: 'Some rain in the north.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 40,
    time: '6m',
    status: 'published',
    order: 9,
  },
  {
    title: 'Directions in town (A2 Listening)',
    slug: 'lesson-listening-a2-directions',
    skill: 'listening',
    level: 'A2',
    category: 'lesson',
    topic: 'Travel',
    description: 'Listen to someone asking for directions.',
    thumbnail: '',
    content: {
      transcript: `Tourist: Excuse me, where is the museum? Local: Go straight on, then turn left at the traffic lights. The museum is on the right, next to the park. Tourist: How far is it? Local: About five minutes on foot. Tourist: Thank you!`,
      duration: 35,
      accent: 'british',
    },
    vocabulary: [{ word: 'traffic lights', meaning: 'đèn giao thông' }, { word: 'on foot', meaning: 'đi bộ' }],
    questions: [
      { question: 'Where is the museum?', type: 'multiple_choice', options: [{ value: 'A', text: 'On the left' }, { value: 'B', text: 'On the right, next to the park' }, { value: 'C', text: 'Opposite the park' }], correctAnswer: 'B', explanation: 'The museum is on the right, next to the park.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 40,
    time: '6m',
    status: 'published',
    order: 10,
  },
  {
    title: 'Write an email to a friend (A1 Writing)',
    slug: 'lesson-writing-a1-email-friend',
    skill: 'writing',
    level: 'A1',
    category: 'lesson',
    topic: 'Life',
    description: 'Learn how to write a short informal email to a friend.',
    thumbnail: '',
    content: {
      prompt: 'Write a short email to a friend. Tell them what you did last weekend (2–3 sentences). Use "I went...", "I saw...", "I had...".',
      wordLimit: { min: 30, max: 60 },
      sampleAnswer: 'Hi! Last weekend I went to the park. I saw many people and had a nice time. I had lunch with my family. See you soon!',
    },
    vocabulary: [{ word: 'informal', meaning: 'không trang trọng' }, { word: 'greeting', meaning: 'lời chào' }],
    questions: [],
    estimatedTime: 10,
    xpReward: 40,
    time: '10m',
    practiceType: 'Email',
    length: '30–60 words',
    status: 'published',
    order: 11,
  },
  {
    title: 'Describe your favourite place (A2 Writing)',
    slug: 'lesson-writing-a2-favourite-place',
    skill: 'writing',
    level: 'A2',
    category: 'lesson',
    topic: 'Life',
    description: 'Write a short paragraph about your favourite place.',
    thumbnail: '',
    content: {
      prompt: 'Write about your favourite place (a room, a park, a café...). Say where it is, what it looks like, and why you like it. Use at least 3 adjectives.',
      wordLimit: { min: 50, max: 80 },
      sampleAnswer: 'My favourite place is the café near my house. It is small and quiet. The walls are blue and there are many books. I like it because I can read and drink coffee there.',
    },
    vocabulary: [{ word: 'paragraph', meaning: 'đoạn văn' }, { word: 'adjective', meaning: 'tính từ' }],
    questions: [],
    estimatedTime: 12,
    xpReward: 50,
    time: '12m',
    practiceType: 'Short paragraph',
    length: '50–80 words',
    status: 'published',
    order: 12,
  },
  {
    title: 'Opinion: best way to travel (B1 Writing)',
    slug: 'lesson-writing-b1-opinion-travel',
    skill: 'writing',
    level: 'B1',
    category: 'lesson',
    topic: 'Travel',
    description: 'Write your opinion about the best way to travel.',
    thumbnail: '',
    content: {
      prompt: 'What is the best way to travel – by plane, train, or car? Write a short paragraph (80–120 words). Give your opinion and 2 reasons. Use "I think...", "In my opinion...", "Firstly...", "Secondly...".',
      wordLimit: { min: 80, max: 120 },
      sampleAnswer: 'In my opinion, the best way to travel is by train. Firstly, you can see the countryside and it is relaxing. Secondly, it is often cheaper than flying for short distances. I think trains are good for the environment too.',
    },
    vocabulary: [{ word: 'opinion', meaning: 'ý kiến' }, { word: 'reason', meaning: 'lý do' }],
    questions: [],
    estimatedTime: 15,
    xpReward: 60,
    time: '15m',
    practiceType: 'Opinion',
    length: '80–120 words',
    status: 'published',
    order: 13,
  },
  {
    title: 'My family (A1 Reading)',
    slug: 'lesson-reading-a1-my-family',
    skill: 'reading',
    level: 'A1',
    category: 'lesson',
    topic: 'Life',
    description: 'Read a short text about a family and learn family words.',
    thumbnail: '',
    content: { text: `I have a small family. I live with my parents and my younger sister. My father is a teacher. My mother works in a hospital. My sister is still at school. We have a dog called Max. We like to have dinner together every evening.` },
    vocabulary: [{ word: 'parents', meaning: 'bố mẹ' }, { word: 'younger', meaning: 'nhỏ hơn' }],
    questions: [
      { question: 'Who does the person live with?', type: 'multiple_choice', options: [{ value: 'A', text: 'Friends' }, { value: 'B', text: 'Parents and sister' }, { value: 'C', text: 'Alone' }], correctAnswer: 'B', explanation: 'I live with my parents and my younger sister.', points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 30,
    status: 'published',
    order: 14,
  },
  {
    title: 'Technology in our lives (B1 Reading)',
    slug: 'lesson-reading-b1-technology',
    skill: 'reading',
    level: 'B1',
    category: 'lesson',
    topic: 'Technology',
    description: 'Read about how technology affects our daily life.',
    thumbnail: '',
    content: { text: `Technology is everywhere. We use smartphones to talk, message and take photos. We use computers for work and study. Many people work from home now. But too much screen time can be bad for our eyes and sleep. It is important to take breaks.` },
    vocabulary: [{ word: 'screen time', meaning: 'thời gian dùng màn hình' }, { word: 'affect', meaning: 'ảnh hưởng' }],
    questions: [
      { question: 'What can too much screen time be bad for?', type: 'multiple_choice', options: [{ value: 'A', text: 'Eating' }, { value: 'B', text: 'Eyes and sleep' }, { value: 'C', text: 'Walking' }], correctAnswer: 'B', explanation: 'Too much screen time can be bad for our eyes and sleep.', points: 10 },
    ],
    estimatedTime: 7,
    xpReward: 50,
    status: 'published',
    order: 15,
  },
]

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.DB_NAME || 'engsocial' })
    console.log('MongoDB connected')

    for (const lesson of lessons) {
      const existing = await Lesson.findOne({ slug: lesson.slug })
      if (existing) {
        console.log('Skip (exists):', lesson.slug)
        continue
      }
      lesson.totalQuestions = (lesson.questions || []).length
      await Lesson.create(lesson)
      console.log('Created:', lesson.slug)
    }

    console.log('Done. Lessons seeded.')
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

seed()
