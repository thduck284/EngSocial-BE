/**
 * Seed Reading lessons (A1–B2, multiple topics) into MongoDB.
 * Run from EngSocial-BE: node database/seed-reading-lessons.js
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

const readingLessons = [
  {
    title: 'Poster – work (A1 Reading)',
    slug: 'practice-reading-a1-poster-work',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Work',
    description: 'Read a poster about a lunchtime yoga class at work: when, where, how much, and how to join.',
    thumbnail: '',
    content: {
      text: `Come and join our lunchtime yoga class with experienced yoga teacher Divya Bridge!

When? Every Tuesday at 1.30 p.m.

Where? Meeting Room 7

How much? £10 for four 30-minute classes.

What to bring? Comfortable clothes. Divya will provide the yoga mats.

How to join? Write to Sam at Sam.Holden@example.com

We can only take a maximum of 20 in the room, so book now!`,
    },
    vocabulary: [
      { word: 'lunchtime', meaning: 'giờ nghỉ trưa' },
      { word: 'experienced', meaning: 'có kinh nghiệm' },
      { word: 'provide', meaning: 'cung cấp' },
      { word: 'yoga mat', meaning: 'thảm yoga' },
      { word: 'maximum', meaning: 'tối đa' },
      { word: 'book', meaning: 'đặt chỗ' },
    ],
    questions: [
      { question: 'When is the yoga class?', type: 'multiple_choice', options: [{ value: 'A', text: 'Every Tuesday at 1.30 p.m.' }, { value: 'B', text: 'Every Monday at 1.30 p.m.' }, { value: 'C', text: 'Every Tuesday at 2 p.m.' }], correctAnswer: 'A', explanation: 'Poster says: "When? Every Tuesday at 1.30 p.m."', points: 10 },
      { question: 'Where is the yoga class?', type: 'multiple_choice', options: [{ value: 'A', text: 'Meeting Room 7' }, { value: 'B', text: 'Meeting Room 5' }, { value: 'C', text: 'The gym' }], correctAnswer: 'A', explanation: '"Where? Meeting Room 7"', points: 10 },
      { question: 'How much does it cost for the four 30-minute classes?', type: 'multiple_choice', options: [{ value: 'A', text: '£10' }, { value: 'B', text: '£20' }, { value: 'C', text: 'Free' }], correctAnswer: 'A', explanation: '"How much? £10 for four 30-minute classes."', points: 10 },
      { question: 'How can you join the class?', type: 'multiple_choice', options: [{ value: 'A', text: 'Write to Sam at Sam.Holden@example.com' }, { value: 'B', text: 'Call Divya' }, { value: 'C', text: 'Go to Meeting Room 7 on Tuesday' }], correctAnswer: 'A', explanation: '"How to join? Write to Sam at Sam.Holden@example.com"', points: 10 },
      { question: 'The room can take a maximum of 20 people.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: '"We can only take a maximum of 20 in the room, so book now!"', points: 10 },
      { question: 'Who is the yoga teacher?', type: 'multiple_choice', options: [{ value: 'A', text: 'Divya Bridge' }, { value: 'B', text: 'Sam Holden' }, { value: 'C', text: 'Not mentioned' }], correctAnswer: 'A', explanation: 'Experienced yoga teacher Divya Bridge.', points: 10 },
      { question: 'You need to bring your own yoga mat.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Divya will provide the yoga mats.', points: 10 },
    ],
    estimatedTime: 5,
    xpReward: 50,
    time: '5m',
    practiceType: 'Poster',
    length: 'Short read',
    status: 'published',
    order: 1,
  },
  {
    title: 'At the library (A1 Reading)',
    slug: 'practice-reading-a1-at-the-library',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Study',
    description: 'Read a short notice about library opening hours and rules.',
    thumbnail: '',
    content: {
      text: `CENTRAL LIBRARY – NOTICE

Opening hours:
Monday – Friday: 9 a.m. – 6 p.m.
Saturday: 10 a.m. – 4 p.m.
Closed on Sundays and public holidays.

Rules:
- Please keep quiet in the reading room.
- No food or drinks. You can use the café on the ground floor.
- You need a library card to borrow books. Get your free card at the desk.
- You can borrow up to 5 books for 2 weeks.

For more information, visit our website or ask at the desk.`,
    },
    vocabulary: [
      { word: 'notice', meaning: 'thông báo' },
      { word: 'borrow', meaning: 'mượn' },
      { word: 'ground floor', meaning: 'tầng trệt' },
      { word: 'quiet', meaning: 'giữ yên lặng' },
      { word: 'public holiday', meaning: 'ngày lễ' },
    ],
    questions: [
      { question: 'When is the library open on Saturday?', type: 'multiple_choice', options: [{ value: 'A', text: '10 a.m. – 4 p.m.' }, { value: 'B', text: '9 a.m. – 6 p.m.' }, { value: 'C', text: 'Closed' }], correctAnswer: 'A', explanation: 'Saturday: 10 a.m. – 4 p.m.', points: 10 },
      { question: 'The library is open on Sundays.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Closed on Sundays and public holidays.', points: 10 },
      { question: 'Where can you eat or drink in the building?', type: 'multiple_choice', options: [{ value: 'A', text: 'In the reading room' }, { value: 'B', text: 'In the café on the ground floor' }, { value: 'C', text: 'Nowhere' }], correctAnswer: 'B', explanation: 'You can use the café on the ground floor.', points: 10 },
      { question: 'How many books can you borrow at one time?', type: 'multiple_choice', options: [{ value: 'A', text: '2' }, { value: 'B', text: '5' }, { value: 'C', text: '10' }], correctAnswer: 'B', explanation: 'You can borrow up to 5 books for 2 weeks.', points: 10 },
      { question: 'You need to pay for a library card.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Get your free card at the desk.', points: 10 },
      { question: 'How long can you keep the books?', type: 'multiple_choice', options: [{ value: 'A', text: '1 week' }, { value: 'B', text: '2 weeks' }, { value: 'C', text: '1 month' }], correctAnswer: 'B', explanation: 'Up to 5 books for 2 weeks.', points: 10 },
      { question: 'You must keep quiet in the reading room.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Please keep quiet in the reading room.', points: 10 },
      { question: 'On weekdays the library closes at:', type: 'multiple_choice', options: [{ value: 'A', text: '4 p.m.' }, { value: 'B', text: '5 p.m.' }, { value: 'C', text: '6 p.m.' }], correctAnswer: 'C', explanation: 'Monday – Friday: 9 a.m. – 6 p.m.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Notice',
    length: 'Short read',
    status: 'published',
    order: 2,
  },
  {
    title: 'Hotel booking (A1 Reading)',
    slug: 'practice-reading-a1-hotel-booking',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Travel',
    description: 'Read an email confirmation for a hotel booking.',
    thumbnail: '',
    content: {
      text: `Dear Mr Chen,

Thank you for your booking at the Riverside Hotel.

Your reservation:
- Check-in: Friday, 15 March, from 3 p.m.
- Check-out: Sunday, 17 March, by 11 a.m.
- Room: Double room with breakfast
- Total: £180 for 2 nights

Please bring this email and your ID when you arrive. If you need to cancel, please tell us at least 24 hours before check-in.

We look forward to seeing you.

Best regards,
The Riverside Hotel Team`,
    },
    vocabulary: [
      { word: 'reservation', meaning: 'đặt phòng' },
      { word: 'check-in', meaning: 'nhận phòng' },
      { word: 'check-out', meaning: 'trả phòng' },
      { word: 'cancel', meaning: 'hủy' },
      { word: 'look forward to', meaning: 'mong đợi' },
    ],
    questions: [
      { question: 'When is check-in?', type: 'multiple_choice', options: [{ value: 'A', text: 'Friday 15 March, from 3 p.m.' }, { value: 'B', text: 'Sunday 17 March' }, { value: 'C', text: 'Saturday 16 March' }], correctAnswer: 'A', explanation: 'Check-in: Friday, 15 March, from 3 p.m.', points: 10 },
      { question: 'By what time must the guest leave on Sunday?', type: 'multiple_choice', options: [{ value: 'A', text: '10 a.m.' }, { value: 'B', text: '11 a.m.' }, { value: 'C', text: '3 p.m.' }], correctAnswer: 'B', explanation: 'Check-out: Sunday, 17 March, by 11 a.m.', points: 10 },
      { question: 'What is included in the room?', type: 'multiple_choice', options: [{ value: 'A', text: 'Dinner' }, { value: 'B', text: 'Breakfast' }, { value: 'C', text: 'Lunch' }], correctAnswer: 'B', explanation: 'Double room with breakfast.', points: 10 },
      { question: 'How much is the stay for 2 nights?', type: 'multiple_choice', options: [{ value: 'A', text: '£90' }, { value: 'B', text: '£180' }, { value: 'C', text: '£360' }], correctAnswer: 'B', explanation: 'Total: £180 for 2 nights.', points: 10 },
      { question: 'To cancel, you must tell the hotel at least 24 hours before check-in.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Please tell us at least 24 hours before check-in.', points: 10 },
      { question: 'What should the guest bring when they arrive?', type: 'multiple_choice', options: [{ value: 'A', text: 'Only ID' }, { value: 'B', text: 'This email and ID' }, { value: 'C', text: 'Payment only' }], correctAnswer: 'B', explanation: 'Please bring this email and your ID when you arrive.', points: 10 },
      { question: 'The guest booked for one night.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: '£180 for 2 nights.', points: 10 },
      { question: 'What type of room did Mr Chen book?', type: 'multiple_choice', options: [{ value: 'A', text: 'Single room' }, { value: 'B', text: 'Double room with breakfast' }, { value: 'C', text: 'Suite' }], correctAnswer: 'B', explanation: 'Room: Double room with breakfast.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Email',
    length: 'Short read',
    status: 'published',
    order: 3,
  },
  {
    title: 'Office meeting notice (A1 Reading)',
    slug: 'practice-reading-a1-office-meeting',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Work',
    description: 'Read a short notice about a team meeting and agenda.',
    thumbnail: '',
    content: {
      text: `TEAM MEETING – ALL STAFF

Date: Thursday, 22 May
Time: 2 p.m. – 3.30 p.m.
Place: Conference Room B (Building 2, 3rd floor)

Agenda:
1. Project update (15 min)
2. New schedule for June (20 min)
3. Questions and ideas (25 min)

Please come on time. Bring your laptop if you have one. We will need everyone’s ideas for the June plan.

If you cannot come, please email Anna by Tuesday 20 May.

Thank you.`,
    },
    vocabulary: [
      { word: 'agenda', meaning: 'chương trình nghị sự' },
      { word: 'schedule', meaning: 'lịch' },
      { word: 'conference', meaning: 'hội nghị' },
      { word: 'update', meaning: 'cập nhật' },
    ],
    questions: [
      { question: 'When is the meeting?', type: 'multiple_choice', options: [{ value: 'A', text: 'Thursday 22 May, 2 p.m. – 3.30 p.m.' }, { value: 'B', text: 'Tuesday 20 May' }, { value: 'C', text: 'Friday 22 May' }], correctAnswer: 'A', explanation: 'Date: Thursday, 22 May. Time: 2 p.m. – 3.30 p.m.', points: 10 },
      { question: 'Where is the meeting?', type: 'multiple_choice', options: [{ value: 'A', text: 'Building 1' }, { value: 'B', text: 'Conference Room B, Building 2, 3rd floor' }, { value: 'C', text: 'Meeting Room 7' }], correctAnswer: 'B', explanation: 'Place: Conference Room B (Building 2, 3rd floor).', points: 10 },
      { question: 'How long is the meeting?', type: 'multiple_choice', options: [{ value: 'A', text: '1 hour' }, { value: 'B', text: '1 hour 30 minutes' }, { value: 'C', text: '2 hours' }], correctAnswer: 'B', explanation: '2 p.m. – 3.30 p.m. is 1.5 hours.', points: 10 },
      { question: 'What is the first item on the agenda?', type: 'multiple_choice', options: [{ value: 'A', text: 'New schedule for June' }, { value: 'B', text: 'Project update' }, { value: 'C', text: 'Questions and ideas' }], correctAnswer: 'B', explanation: '1. Project update (15 min).', points: 10 },
      { question: 'Staff should bring a laptop if they have one.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Bring your laptop if you have one.', points: 10 },
      { question: 'If you cannot come, you must email Anna by:', type: 'multiple_choice', options: [{ value: 'A', text: '22 May' }, { value: 'B', text: '20 May' }, { value: 'C', text: '23 May' }], correctAnswer: 'B', explanation: 'Please email Anna by Tuesday 20 May.', points: 10 },
      { question: 'The meeting is only for managers.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'TEAM MEETING – ALL STAFF.', points: 10 },
      { question: 'How much time is for "Questions and ideas"?', type: 'multiple_choice', options: [{ value: 'A', text: '15 min' }, { value: 'B', text: '20 min' }, { value: 'C', text: '25 min' }], correctAnswer: 'C', explanation: '3. Questions and ideas (25 min).', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Notice',
    length: 'Short read',
    status: 'published',
    order: 4,
  },
  {
    title: 'Café menu (A1 Reading)',
    slug: 'practice-reading-a1-cafe-menu',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Food and drink',
    description: 'Read a simple café menu and notice.',
    thumbnail: '',
    content: {
      text: `THE GREEN CAFÉ – MENU

Hot drinks:
- Coffee (small £2.20, medium £2.60, large £3.00)
- Tea £2.00
- Hot chocolate £3.20

Cold drinks:
- Orange juice £2.50
- Lemonade £2.20
- Water (free)

Sandwiches:
- Cheese £4.50
- Chicken £5.00
- Egg £4.00

Cakes: £3.50 each

We are open 8 a.m. – 5 p.m. Monday to Saturday. Closed Sundays.
Free Wi-Fi for customers. Please order at the counter.`,
    },
    vocabulary: [
      { word: 'menu', meaning: 'thực đơn' },
      { word: 'counter', meaning: 'quầy' },
      { word: 'customer', meaning: 'khách hàng' },
      { word: 'order', meaning: 'gọi món' },
    ],
    questions: [
      { question: 'How much is a large coffee?', type: 'multiple_choice', options: [{ value: 'A', text: '£2.60' }, { value: 'B', text: '£3.00' }, { value: 'C', text: '£2.20' }], correctAnswer: 'B', explanation: 'Coffee large £3.00.', points: 10 },
      { question: 'Water is free.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Water (free).', points: 10 },
      { question: 'Which sandwich is the most expensive?', type: 'multiple_choice', options: [{ value: 'A', text: 'Cheese' }, { value: 'B', text: 'Chicken' }, { value: 'C', text: 'Egg' }], correctAnswer: 'B', explanation: 'Chicken £5.00.', points: 10 },
      { question: 'The café is open on Sundays.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Closed Sundays.', points: 10 },
      { question: 'What time does the café close?', type: 'multiple_choice', options: [{ value: 'A', text: '4 p.m.' }, { value: 'B', text: '5 p.m.' }, { value: 'C', text: '6 p.m.' }], correctAnswer: 'B', explanation: 'Open 8 a.m. – 5 p.m.', points: 10 },
      { question: 'How much is one cake?', type: 'multiple_choice', options: [{ value: 'A', text: '£3.00' }, { value: 'B', text: '£3.50' }, { value: 'C', text: '£4.00' }], correctAnswer: 'B', explanation: 'Cakes: £3.50 each.', points: 10 },
      { question: 'Customers can use free Wi-Fi.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Free Wi-Fi for customers.', points: 10 },
      { question: 'Where do you order?', type: 'multiple_choice', options: [{ value: 'A', text: 'At the table' }, { value: 'B', text: 'At the counter' }, { value: 'C', text: 'Online only' }], correctAnswer: 'B', explanation: 'Please order at the counter.', points: 10 },
      { question: 'How much is hot chocolate?', type: 'multiple_choice', options: [{ value: 'A', text: '£2.60' }, { value: 'B', text: '£3.00' }, { value: 'C', text: '£3.20' }], correctAnswer: 'C', explanation: 'Hot chocolate £3.20.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Menu',
    length: 'Short read',
    status: 'published',
    order: 5,
  },
  {
    title: 'Bus timetable (A1 Reading)',
    slug: 'practice-reading-a1-bus-timetable',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Transport',
    description: 'Read a simple bus timetable and travel information.',
    thumbnail: '',
    content: {
      text: `CITY BUS – LINE 12

From: Central Station  To: Green Park

Monday – Friday:
6.00  6.30  7.00  7.30  8.00  8.30  9.00
Then every 30 minutes until 6 p.m.
Last bus: 10 p.m.

Saturday & Sunday:
First bus: 8.00 a.m.
Every 45 minutes until 8 p.m.

Tickets: Buy on the bus or at the station. Single trip £2. Children under 5 travel free.

For more times: www.citybus.com/line12`,
    },
    vocabulary: [
      { word: 'timetable', meaning: 'lịch trình' },
      { word: 'single trip', meaning: 'một chiều' },
      { word: 'last bus', meaning: 'chuyến cuối' },
    ],
    questions: [
      { question: 'On weekdays, what time is the first bus?', type: 'multiple_choice', options: [{ value: 'A', text: '5.30' }, { value: 'B', text: '6.00' }, { value: 'C', text: '6.30' }], correctAnswer: 'B', explanation: 'Monday – Friday first time: 6.00.', points: 10 },
      { question: 'When is the last bus on weekdays?', type: 'multiple_choice', options: [{ value: 'A', text: '6 p.m.' }, { value: 'B', text: '8 p.m.' }, { value: 'C', text: '10 p.m.' }], correctAnswer: 'C', explanation: 'Last bus: 10 p.m.', points: 10 },
      { question: 'On Saturday the first bus is at 8 a.m.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Saturday & Sunday: First bus: 8.00 a.m.', points: 10 },
      { question: 'How much is a single trip?', type: 'multiple_choice', options: [{ value: 'A', text: '£1' }, { value: 'B', text: '£2' }, { value: 'C', text: '£3' }], correctAnswer: 'B', explanation: 'Single trip £2.', points: 10 },
      { question: 'Children under 5 must pay for the bus.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Children under 5 travel free.', points: 10 },
      { question: 'Where does Line 12 go?', type: 'multiple_choice', options: [{ value: 'A', text: 'Central Station to Green Park' }, { value: 'B', text: 'Green Park to Central Station only' }, { value: 'C', text: 'Airport to City' }], correctAnswer: 'A', explanation: 'From: Central Station  To: Green Park.', points: 10 },
      { question: 'On weekdays between 9 a.m. and 6 p.m., buses run every 30 minutes.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Then every 30 minutes until 6 p.m.', points: 10 },
      { question: 'On Sunday, how often do buses run?', type: 'multiple_choice', options: [{ value: 'A', text: 'Every 30 minutes' }, { value: 'B', text: 'Every 45 minutes' }, { value: 'C', text: 'Every hour' }], correctAnswer: 'B', explanation: 'Saturday & Sunday: Every 45 minutes until 8 p.m.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Timetable',
    length: 'Short read',
    status: 'published',
    order: 6,
  },
  // ---- 10 new lessons: diverse topic & level ----
  {
    title: 'University course notice (A2 Reading)',
    slug: 'practice-reading-a2-university-course',
    skill: 'reading',
    level: 'A2',
    category: 'practice',
    topic: 'Study',
    description: 'Read a notice about a university English course: dates, requirements and how to apply.',
    thumbnail: '',
    content: {
      text: `ENGLISH FOR ACADEMIC PURPOSES – SPRING TERM

This course is for students who want to improve their English for university. You will practise reading, writing and giving short presentations.

When: 15 January – 28 March (12 weeks)
Classes: Tuesday and Thursday, 2 p.m. – 4 p.m.
Room: Block C, Room 204

Requirements: You need to be at least 18 years old. We recommend level A2 or above. There is a short test on the first day to check your level.

Fee: £240 for the full course. You can pay in two parts.

To apply: Fill in the form on our website and send it before 5 January. Places are limited to 25 students.

Contact: languages@university.ac.uk`,
    },
    vocabulary: [
      { word: 'academic', meaning: 'học thuật' },
      { word: 'requirements', meaning: 'yêu cầu' },
      { word: 'fee', meaning: 'học phí' },
      { word: 'limited', meaning: 'giới hạn' },
    ],
    questions: [
      { question: 'How long does the course last?', type: 'multiple_choice', options: [{ value: 'A', text: '10 weeks' }, { value: 'B', text: '12 weeks' }, { value: 'C', text: '14 weeks' }], correctAnswer: 'B', explanation: '15 January – 28 March (12 weeks).', points: 10 },
      { question: 'On which days are the classes?', type: 'multiple_choice', options: [{ value: 'A', text: 'Monday and Wednesday' }, { value: 'B', text: 'Tuesday and Thursday' }, { value: 'C', text: 'Friday only' }], correctAnswer: 'B', explanation: 'Tuesday and Thursday, 2 p.m. – 4 p.m.', points: 10 },
      { question: 'What is the total fee for the course?', type: 'multiple_choice', options: [{ value: 'A', text: '£120' }, { value: 'B', text: '£240' }, { value: 'C', text: '£480' }], correctAnswer: 'B', explanation: 'Fee: £240 for the full course.', points: 10 },
      { question: 'You must be at least 18 to join the course.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'You need to be at least 18 years old.', points: 10 },
      { question: 'When is the deadline to apply?', type: 'multiple_choice', options: [{ value: 'A', text: '15 January' }, { value: 'B', text: '5 January' }, { value: 'C', text: '28 March' }], correctAnswer: 'B', explanation: 'Send it before 5 January.', points: 10 },
      { question: 'Maximum number of students on the course is 25.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Places are limited to 25 students.', points: 10 },
      { question: 'Where is the class held?', type: 'multiple_choice', options: [{ value: 'A', text: 'Block A, Room 204' }, { value: 'B', text: 'Block C, Room 204' }, { value: 'C', text: 'Block C, Room 104' }], correctAnswer: 'B', explanation: 'Room: Block C, Room 204.', points: 10 },
    ],
    estimatedTime: 8,
    xpReward: 60,
    time: '8m',
    practiceType: 'Notice',
    length: 'Short read',
    status: 'published',
    order: 7,
  },
  {
    title: 'Airport information (A2 Reading)',
    slug: 'practice-reading-a2-airport-info',
    skill: 'reading',
    level: 'A2',
    category: 'practice',
    topic: 'Travel',
    description: 'Read airport information about check-in, baggage and boarding.',
    thumbnail: '',
    content: {
      text: `LONDON HEATHROW – TERMINAL 2 INFORMATION

Check-in: Please arrive at least 2 hours before your flight for international travel. Check-in desks open 3 hours before departure. You can check in online 24 hours before your flight.

Baggage: Each passenger can take one cabin bag (max 56 cm x 45 cm x 25 cm) and one small personal item. For checked baggage, the limit is 23 kg per bag. If your bag is heavier, you may need to pay extra.

Boarding: Boarding usually starts 45 minutes before departure. Listen for your flight number and gate. You need your boarding pass and passport to board.

Security: Take your laptop and liquids out of your bag. Liquids must be in bottles of 100 ml or less, in a clear bag.`,
    },
    vocabulary: [
      { word: 'departure', meaning: 'giờ khởi hành' },
      { word: 'cabin bag', meaning: 'hành lý xách tay' },
      { word: 'boarding pass', meaning: 'thẻ lên máy bay' },
      { word: 'liquid', meaning: 'chất lỏng' },
    ],
    questions: [
      { question: 'How early should you arrive for an international flight?', type: 'multiple_choice', options: [{ value: 'A', text: '1 hour before' }, { value: 'B', text: 'At least 2 hours before' }, { value: 'C', text: '30 minutes before' }], correctAnswer: 'B', explanation: 'Arrive at least 2 hours before your flight for international travel.', points: 10 },
      { question: 'When do check-in desks open?', type: 'multiple_choice', options: [{ value: 'A', text: '1 hour before departure' }, { value: 'B', text: '2 hours before departure' }, { value: 'C', text: '3 hours before departure' }], correctAnswer: 'C', explanation: 'Check-in desks open 3 hours before departure.', points: 10 },
      { question: 'What is the weight limit for checked baggage?', type: 'multiple_choice', options: [{ value: 'A', text: '20 kg' }, { value: 'B', text: '23 kg' }, { value: 'C', text: '25 kg' }], correctAnswer: 'B', explanation: 'The limit is 23 kg per bag.', points: 10 },
      { question: 'Boarding starts 30 minutes before departure.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Boarding usually starts 45 minutes before departure.', points: 10 },
      { question: 'Liquids must be in bottles of 100 ml or less.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Liquids must be in bottles of 100 ml or less, in a clear bag.', points: 10 },
      { question: 'What do you need to show when boarding?', type: 'multiple_choice', options: [{ value: 'A', text: 'Ticket only' }, { value: 'B', text: 'Boarding pass and passport' }, { value: 'C', text: 'ID card only' }], correctAnswer: 'B', explanation: 'You need your boarding pass and passport to board.', points: 10 },
      { question: 'You can check in online 24 hours before the flight.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'You can check in online 24 hours before your flight.', points: 10 },
    ],
    estimatedTime: 7,
    xpReward: 60,
    time: '7m',
    practiceType: 'Information',
    length: 'Short read',
    status: 'published',
    order: 8,
  },
  {
    title: 'Part-time job advert (A1 Reading)',
    slug: 'practice-reading-a1-job-advert',
    skill: 'reading',
    level: 'A1',
    category: 'practice',
    topic: 'Business',
    description: 'Read a simple advert for a part-time job in a shop.',
    thumbnail: '',
    content: {
      text: `PART-TIME SHOP ASSISTANT NEEDED

We are a small bookshop in the city centre. We need a friendly person to help us at the weekend.

Hours: Saturday 9 a.m. – 5 p.m., Sunday 10 a.m. – 4 p.m.
Pay: £10 per hour

You will: serve customers, put books on the shelves, and help with the till.

We want someone who: likes books, can speak English well, and is on time.

No experience needed. Training given.

To apply: Come to the shop with your CV or call 020 7946 0123. Ask for Mrs Brown.`,
    },
    vocabulary: [
      { word: 'part-time', meaning: 'bán thời gian' },
      { word: 'assistant', meaning: 'trợ lý' },
      { word: 'till', meaning: 'quầy thu ngân' },
      { word: 'CV', meaning: 'sơ yếu lý lịch' },
    ],
    questions: [
      { question: 'When does the shop need help?', type: 'multiple_choice', options: [{ value: 'A', text: 'Weekdays only' }, { value: 'B', text: 'At the weekend' }, { value: 'C', text: 'Every day' }], correctAnswer: 'B', explanation: 'We need a friendly person to help us at the weekend.', points: 10 },
      { question: 'How much is the pay per hour?', type: 'multiple_choice', options: [{ value: 'A', text: '£8' }, { value: 'B', text: '£10' }, { value: 'C', text: '£12' }], correctAnswer: 'B', explanation: 'Pay: £10 per hour.', points: 10 },
      { question: 'Experience is required for this job.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'No experience needed. Training given.', points: 10 },
      { question: 'Who should you ask for when you call?', type: 'multiple_choice', options: [{ value: 'A', text: 'Mr Brown' }, { value: 'B', text: 'Mrs Brown' }, { value: 'C', text: 'The manager' }], correctAnswer: 'B', explanation: 'Ask for Mrs Brown.', points: 10 },
      { question: 'On Sunday, what time does the shift end?', type: 'multiple_choice', options: [{ value: 'A', text: '3 p.m.' }, { value: 'B', text: '4 p.m.' }, { value: 'C', text: '5 p.m.' }], correctAnswer: 'B', explanation: 'Sunday 10 a.m. – 4 p.m.', points: 10 },
      { question: 'The job includes putting books on the shelves.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'You will: serve customers, put books on the shelves, and help with the till.', points: 10 },
      { question: 'Where is the shop?', type: 'multiple_choice', options: [{ value: 'A', text: 'Outside the city' }, { value: 'B', text: 'In the city centre' }, { value: 'C', text: 'At the airport' }], correctAnswer: 'B', explanation: 'We are a small bookshop in the city centre.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 50,
    time: '6m',
    practiceType: 'Advert',
    length: 'Short read',
    status: 'published',
    order: 9,
  },
  {
    title: 'Office memo – remote work (B1 Reading)',
    slug: 'practice-reading-b1-office-memo',
    skill: 'reading',
    level: 'B1',
    category: 'practice',
    topic: 'Work',
    description: 'Read a memo about remote work policy and rules.',
    thumbnail: '',
    content: {
      text: `MEMO: REMOTE WORK POLICY (FROM 1 JUNE)

Dear team,

From 1 June we are updating our remote work policy. Please read the points below.

Who can work from home: All full-time staff can work from home up to 2 days per week. You must agree the days with your manager. Part-time staff can work from home 1 day per week.

Rules when working from home:
- You must be available online between 9 a.m. and 5 p.m. on your work days.
- You must join the daily team call at 10 a.m.
- You should reply to emails within 4 hours during work time.
- If you have a problem with your computer or internet, tell your manager the same day.

Equipment: The company will not provide a second laptop. You can use your own computer if it is secure. We will pay up to £30 per month towards your home internet if you work from home at least 8 days per month.

If you have questions, contact HR at hr@company.com by 20 May.

Best regards,
Management`,
    },
    vocabulary: [
      { word: 'memo', meaning: 'thông báo nội bộ' },
      { word: 'remote', meaning: 'từ xa' },
      { word: 'policy', meaning: 'chính sách' },
      { word: 'equipment', meaning: 'trang thiết bị' },
    ],
    questions: [
      { question: 'From when does the new policy start?', type: 'multiple_choice', options: [{ value: 'A', text: '1 May' }, { value: 'B', text: '1 June' }, { value: 'C', text: '20 May' }], correctAnswer: 'B', explanation: 'From 1 June we are updating our remote work policy.', points: 10 },
      { question: 'How many days per week can full-time staff work from home?', type: 'multiple_choice', options: [{ value: 'A', text: '1 day' }, { value: 'B', text: '2 days' }, { value: 'C', text: '3 days' }], correctAnswer: 'B', explanation: 'All full-time staff can work from home up to 2 days per week.', points: 10 },
      { question: 'Part-time staff can work from home 2 days per week.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Part-time staff can work from home 1 day per week.', points: 10 },
      { question: 'When is the daily team call?', type: 'multiple_choice', options: [{ value: 'A', text: '9 a.m.' }, { value: 'B', text: '10 a.m.' }, { value: 'C', text: '5 p.m.' }], correctAnswer: 'B', explanation: 'You must join the daily team call at 10 a.m.', points: 10 },
      { question: 'The company will provide a second laptop for home use.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'The company will not provide a second laptop.', points: 10 },
      { question: 'How much can the company pay towards home internet per month?', type: 'multiple_choice', options: [{ value: 'A', text: '£20' }, { value: 'B', text: '£30' }, { value: 'C', text: '£50' }], correctAnswer: 'B', explanation: 'We will pay up to £30 per month towards your home internet.', points: 10 },
      { question: 'You should reply to emails within 4 hours during work time.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'You should reply to emails within 4 hours during work time.', points: 10 },
      { question: 'When should you contact HR if you have questions?', type: 'multiple_choice', options: [{ value: 'A', text: 'After 1 June' }, { value: 'B', text: 'By 20 May' }, { value: 'C', text: 'By 1 June' }], correctAnswer: 'B', explanation: 'Contact HR at hr@company.com by 20 May.', points: 10 },
    ],
    estimatedTime: 8,
    xpReward: 70,
    time: '8m',
    practiceType: 'Memo',
    length: 'Short read',
    status: 'published',
    order: 10,
  },
  {
    title: 'Restaurant review (A2 Reading)',
    slug: 'practice-reading-a2-restaurant-review',
    skill: 'reading',
    level: 'A2',
    category: 'practice',
    topic: 'Food and drink',
    description: 'Read a short restaurant review and understand the writer’s opinion.',
    thumbnail: '',
    content: {
      text: `THE BLUE FISH – RESTAURANT REVIEW

I went to The Blue Fish last Saturday with my family. The restaurant is near the river and has a nice view. We booked a table for 7 p.m. and we didn’t have to wait.

The menu has a lot of fish and seafood. I had grilled salmon with vegetables – it was delicious and not too expensive (£18). My husband had fish and chips. The chips were good but the fish was a bit dry. The children’s menu is small but our kids liked the pasta.

The service was friendly and quick. We got our starters in about 10 minutes. The only problem was the noise – the restaurant was full and it was quite loud. So if you want a quiet evening, maybe go on a weekday.

I would go again for the food and the view. I give it 4 out of 5.`,
    },
    vocabulary: [
      { word: 'grilled', meaning: 'nướng' },
      { word: 'seafood', meaning: 'hải sản' },
      { word: 'starter', meaning: 'món khai vị' },
      { word: 'service', meaning: 'dịch vụ phục vụ' },
    ],
    questions: [
      { question: 'Where is The Blue Fish restaurant?', type: 'multiple_choice', options: [{ value: 'A', text: 'In the mountains' }, { value: 'B', text: 'Near the river' }, { value: 'C', text: 'In the city centre' }], correctAnswer: 'B', explanation: 'The restaurant is near the river and has a nice view.', points: 10 },
      { question: 'What did the writer order?', type: 'multiple_choice', options: [{ value: 'A', text: 'Fish and chips' }, { value: 'B', text: 'Grilled salmon with vegetables' }, { value: 'C', text: 'Pasta' }], correctAnswer: 'B', explanation: 'I had grilled salmon with vegetables.', points: 10 },
      { question: 'How much did the salmon cost?', type: 'multiple_choice', options: [{ value: 'A', text: '£15' }, { value: 'B', text: '£18' }, { value: 'C', text: '£20' }], correctAnswer: 'B', explanation: 'It was delicious and not too expensive (£18).', points: 10 },
      { question: 'The writer thought the fish and chips were perfect.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'The fish was a bit dry.', points: 10 },
      { question: 'What was the problem with the restaurant?', type: 'multiple_choice', options: [{ value: 'A', text: 'Slow service' }, { value: 'B', text: 'The noise' }, { value: 'C', text: 'High prices' }], correctAnswer: 'B', explanation: 'The only problem was the noise – the restaurant was full and it was quite loud.', points: 10 },
      { question: 'What rating did the writer give?', type: 'multiple_choice', options: [{ value: 'A', text: '3 out of 5' }, { value: 'B', text: '4 out of 5' }, { value: 'C', text: '5 out of 5' }], correctAnswer: 'B', explanation: 'I give it 4 out of 5.', points: 10 },
      { question: 'The writer would go again.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'I would go again for the food and the view.', points: 10 },
    ],
    estimatedTime: 7,
    xpReward: 60,
    time: '7m',
    practiceType: 'Review',
    length: 'Short read',
    status: 'published',
    order: 11,
  },
  {
    title: 'Travel blog – weekend in Edinburgh (B1 Reading)',
    slug: 'practice-reading-b1-travel-edinburgh',
    skill: 'reading',
    level: 'B1',
    category: 'practice',
    topic: 'Travel',
    description: 'Read a travel blog about a weekend trip to Edinburgh.',
    thumbnail: '',
    content: {
      text: `WEEKEND IN EDINBURGH – MY TRIP LAST MONTH

I had always wanted to visit Edinburgh, so when my friend suggested a weekend there, I said yes immediately. We took the train from London on Friday evening – it takes about 4 and a half hours – and arrived at the hotel at 11 p.m.

On Saturday we walked up to Edinburgh Castle. The view of the city from the castle is amazing. We spent about 3 hours there. In the afternoon we went to the Royal Mile and bought some souvenirs. The streets were very busy because it was the festival season. In the evening we had dinner in a traditional Scottish restaurant. I tried haggis for the first time – it was interesting but I’m not sure I would order it again!

On Sunday we visited the National Museum of Scotland. It’s free to enter and there’s a lot to see. We had to leave at 3 p.m. to catch our train back to London.

Edinburgh is a beautiful city and I would love to go back. Next time I’d like to see more of the Highlands.`,
    },
    vocabulary: [
      { word: 'souvenir', meaning: 'đồ lưu niệm' },
      { word: 'traditional', meaning: 'truyền thống' },
      { word: 'haggis', meaning: 'món haggis (Scotland)' },
      { word: 'Highlands', meaning: 'vùng cao nguyên Scotland' },
    ],
    questions: [
      { question: 'How did the writer get to Edinburgh?', type: 'multiple_choice', options: [{ value: 'A', text: 'By plane' }, { value: 'B', text: 'By train' }, { value: 'C', text: 'By car' }], correctAnswer: 'B', explanation: 'We took the train from London on Friday evening.', points: 10 },
      { question: 'Approximately how long is the train journey from London to Edinburgh?', type: 'multiple_choice', options: [{ value: 'A', text: '3 hours' }, { value: 'B', text: '4.5 hours' }, { value: 'C', text: '6 hours' }], correctAnswer: 'B', explanation: 'It takes about 4 and a half hours.', points: 10 },
      { question: 'What did they do on Saturday morning?', type: 'multiple_choice', options: [{ value: 'A', text: 'Went to the National Museum' }, { value: 'B', text: 'Walked up to Edinburgh Castle' }, { value: 'C', text: 'Had dinner in a Scottish restaurant' }], correctAnswer: 'B', explanation: 'On Saturday we walked up to Edinburgh Castle.', points: 10 },
      { question: 'The writer loved haggis and would order it again.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: "It was interesting but I'm not sure I would order it again!", points: 10 },
      { question: 'Is the National Museum of Scotland free to enter?', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: "It's free to enter and there's a lot to see.", points: 10 },
      { question: 'Why were the streets very busy?', type: 'multiple_choice', options: [{ value: 'A', text: 'It was Saturday' }, { value: 'B', text: 'It was the festival season' }, { value: 'C', text: 'There was a parade' }], correctAnswer: 'B', explanation: 'The streets were very busy because it was the festival season.', points: 10 },
      { question: 'When did they leave Edinburgh?', type: 'multiple_choice', options: [{ value: 'A', text: 'Sunday morning' }, { value: 'B', text: 'Sunday at 3 p.m.' }, { value: 'C', text: 'Monday' }], correctAnswer: 'B', explanation: 'We had to leave at 3 p.m. to catch our train back to London.', points: 10 },
      { question: 'What would the writer like to do next time?', type: 'multiple_choice', options: [{ value: 'A', text: 'See more of the Highlands' }, { value: 'B', text: 'Try more Scottish food' }, { value: 'C', text: 'Stay longer at the castle' }], correctAnswer: 'A', explanation: "Next time I'd like to see more of the Highlands.", points: 10 },
    ],
    estimatedTime: 8,
    xpReward: 70,
    time: '8m',
    practiceType: 'Blog',
    length: 'Short read',
    status: 'published',
    order: 12,
  },
  {
    title: 'Train timetable and tickets (A2 Reading)',
    slug: 'practice-reading-a2-train-timetable',
    skill: 'reading',
    level: 'A2',
    category: 'practice',
    topic: 'Transport',
    description: 'Read train times and ticket information.',
    thumbnail: '',
    content: {
      text: `FAST TRAIN – LONDON TO BIRMINGHAM

Depart London: 07:15  09:30  12:00  14:45  17:20  19:50
Arrive Birmingham: 09:05  11:20  13:50  16:35  19:10  21:40

Journey time: about 1 hour 50 minutes.

TICKETS:
- Off-peak (after 9:30 a.m. and before 4 p.m. on weekdays): £25 one way
- Peak (all other times): £45 one way
- Return (same day): add £5 to the one-way price
- Children under 16: half price
- Group of 4 or more: 20% discount (book online only)

You can buy tickets at the station, online, or on the train. Tickets on the train cost £5 more. Bikes can travel for free but you must book a space first.`,
    },
    vocabulary: [
      { word: 'off-peak', meaning: 'giờ thấp điểm' },
      { word: 'peak', meaning: 'giờ cao điểm' },
      { word: 'return', meaning: 'khứ hồi' },
      { word: 'discount', meaning: 'giảm giá' },
    ],
    questions: [
      { question: 'How long is the journey from London to Birmingham?', type: 'multiple_choice', options: [{ value: 'A', text: 'About 1 hour' }, { value: 'B', text: 'About 1 hour 50 minutes' }, { value: 'C', text: 'About 2 hours 30 minutes' }], correctAnswer: 'B', explanation: 'Journey time: about 1 hour 50 minutes.', points: 10 },
      { question: 'What time does the 12:00 train from London arrive in Birmingham?', type: 'multiple_choice', options: [{ value: 'A', text: '13:50' }, { value: 'B', text: '14:00' }, { value: 'C', text: '13:45' }], correctAnswer: 'A', explanation: 'Depart 12:00 – Arrive 13:50.', points: 10 },
      { question: 'How much is an off-peak one-way ticket?', type: 'multiple_choice', options: [{ value: 'A', text: '£20' }, { value: 'B', text: '£25' }, { value: 'C', text: '£45' }], correctAnswer: 'B', explanation: 'Off-peak: £25 one way.', points: 10 },
      { question: 'Peak tickets are cheaper than off-peak.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Peak: £45, Off-peak: £25.', points: 10 },
      { question: 'Children under 16 pay full price.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Children under 16: half price.', points: 10 },
      { question: 'How do you get a 20% discount?', type: 'multiple_choice', options: [{ value: 'A', text: 'Travel at off-peak' }, { value: 'B', text: 'Group of 4 or more, book online' }, { value: 'C', text: 'Buy at the station' }], correctAnswer: 'B', explanation: 'Group of 4 or more: 20% discount (book online only).', points: 10 },
      { question: 'If you buy a ticket on the train, how much extra do you pay?', type: 'multiple_choice', options: [{ value: 'A', text: '£2' }, { value: 'B', text: '£5' }, { value: 'C', text: '£10' }], correctAnswer: 'B', explanation: 'Tickets on the train cost £5 more.', points: 10 },
      { question: 'Can you take a bike on the train?', type: 'multiple_choice', options: [{ value: 'A', text: 'No' }, { value: 'B', text: 'Yes, for free but you must book a space' }, { value: 'C', text: 'Yes, but you pay extra' }], correctAnswer: 'B', explanation: 'Bikes can travel for free but you must book a space first.', points: 10 },
    ],
    estimatedTime: 7,
    xpReward: 60,
    time: '7m',
    practiceType: 'Timetable',
    length: 'Short read',
    status: 'published',
    order: 13,
  },
  {
    title: 'Study tips for exams (B1 Reading)',
    slug: 'practice-reading-b1-study-tips',
    skill: 'reading',
    level: 'B1',
    category: 'practice',
    topic: 'Study',
    description: 'Read advice about how to prepare for exams.',
    thumbnail: '',
    content: {
      text: `HOW TO PREPARE FOR EXAMS – SOME TIPS

Many students feel stressed before exams. Here are some ideas that can help.

Start early: Don’t leave everything to the last week. Plan your revision at least 2 or 3 weeks before the exam. Make a timetable and stick to it. It’s better to study for 1 hour every day than to study for 7 hours in one day.

Find a good place: Study in a quiet place where you won’t be disturbed. Turn off your phone or put it in another room. Tell your family or flatmates when you need to focus.

Use different methods: Don’t just read your notes again and again. Try making flashcards, doing practice tests, or explaining the topic to a friend. Testing yourself helps you remember better than only reading.

Rest and sleep: Take short breaks every 45–60 minutes. Get enough sleep – at least 7 hours the night before the exam. If you are tired, you will find it harder to concentrate.

On the exam day: Eat a good breakfast. Arrive a few minutes early. Read each question carefully before you answer. Good luck!`,
    },
    vocabulary: [
      { word: 'revision', meaning: 'ôn tập' },
      { word: 'flashcard', meaning: 'thẻ ghi nhớ' },
      { word: 'concentrate', meaning: 'tập trung' },
      { word: 'disturbed', meaning: 'bị làm phiền' },
    ],
    questions: [
      { question: 'When should you start planning your revision?', type: 'multiple_choice', options: [{ value: 'A', text: 'The last week' }, { value: 'B', text: 'At least 2 or 3 weeks before the exam' }, { value: 'C', text: 'The day before' }], correctAnswer: 'B', explanation: 'Plan your revision at least 2 or 3 weeks before the exam.', points: 10 },
      { question: 'What is better: 7 hours in one day or 1 hour every day?', type: 'multiple_choice', options: [{ value: 'A', text: '7 hours in one day' }, { value: 'B', text: '1 hour every day' }, { value: 'C', text: 'Same' }], correctAnswer: 'B', explanation: "It's better to study for 1 hour every day than to study for 7 hours in one day.", points: 10 },
      { question: 'You should study with your phone on the table.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Turn off your phone or put it in another room.', points: 10 },
      { question: 'Which method is suggested for remembering?', type: 'multiple_choice', options: [{ value: 'A', text: 'Only reading notes' }, { value: 'B', text: 'Testing yourself' }, { value: 'C', text: 'Studying at night only' }], correctAnswer: 'B', explanation: 'Testing yourself helps you remember better than only reading.', points: 10 },
      { question: 'How often should you take short breaks?', type: 'multiple_choice', options: [{ value: 'A', text: 'Every 20 minutes' }, { value: 'B', text: 'Every 45–60 minutes' }, { value: 'C', text: 'Every 2 hours' }], correctAnswer: 'B', explanation: 'Take short breaks every 45–60 minutes.', points: 10 },
      { question: 'How much sleep is recommended the night before the exam?', type: 'multiple_choice', options: [{ value: 'A', text: '5 hours' }, { value: 'B', text: 'At least 7 hours' }, { value: 'C', text: '10 hours' }], correctAnswer: 'B', explanation: 'Get enough sleep – at least 7 hours the night before the exam.', points: 10 },
      { question: 'On exam day you should skip breakfast to save time.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'Eat a good breakfast.', points: 10 },
      { question: 'Making flashcards is one of the suggested methods.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'Try making flashcards, doing practice tests, or explaining the topic to a friend.', points: 10 },
    ],
    estimatedTime: 8,
    xpReward: 70,
    time: '8m',
    practiceType: 'Article',
    length: 'Short read',
    status: 'published',
    order: 14,
  },
  {
    title: 'Company annual report – summary (B2 Reading)',
    slug: 'practice-reading-b2-company-report',
    skill: 'reading',
    level: 'B2',
    category: 'practice',
    topic: 'Business',
    description: 'Read a short summary of a company’s annual report: results and plans.',
    thumbnail: '',
    content: {
      text: `TECH SOLUTIONS LTD – ANNUAL REPORT SUMMARY (2024)

Overview: Tech Solutions had a strong year. Our revenue increased by 12% compared to last year, and we opened two new offices: one in Manchester and one in Berlin. We now have 450 employees worldwide, up from 420 in 2023.

Products: Our main product, CloudSync, had record sales. We also launched a new product called SecureLink for business customers. Early feedback has been positive, and we expect it to become an important part of our business in the next two years.

Challenges: Like many companies, we faced higher costs this year, especially for energy and salaries. We have reduced some costs by improving our IT systems and allowing more staff to work from home. We do not plan to close any offices.

Plans for 2025: We will focus on growing our business in Europe. We are looking for 30 new staff, mainly in sales and customer support. We will also invest in training for all employees. The board is confident that the company can continue to grow if we keep our focus on quality and customer satisfaction.`,
    },
    vocabulary: [
      { word: 'revenue', meaning: 'doanh thu' },
      { word: 'launch', meaning: 'ra mắt' },
      { word: 'board', meaning: 'hội đồng quản trị' },
      { word: 'feedback', meaning: 'phản hồi' },
    ],
    questions: [
      { question: 'By how much did revenue increase compared to last year?', type: 'multiple_choice', options: [{ value: 'A', text: '10%' }, { value: 'B', text: '12%' }, { value: 'C', text: '15%' }], correctAnswer: 'B', explanation: 'Our revenue increased by 12% compared to last year.', points: 10 },
      { question: 'Where are the two new offices?', type: 'multiple_choice', options: [{ value: 'A', text: 'London and Paris' }, { value: 'B', text: 'Manchester and Berlin' }, { value: 'C', text: 'Berlin and London' }], correctAnswer: 'B', explanation: 'We opened two new offices: one in Manchester and one in Berlin.', points: 10 },
      { question: 'How many employees did the company have in 2023?', type: 'multiple_choice', options: [{ value: 'A', text: '420' }, { value: 'B', text: '450' }, { value: 'C', text: '480' }], correctAnswer: 'A', explanation: 'We now have 450 employees worldwide, up from 420 in 2023.', points: 10 },
      { question: 'What is the name of the new product for business customers?', type: 'multiple_choice', options: [{ value: 'A', text: 'CloudSync' }, { value: 'B', text: 'SecureLink' }, { value: 'C', text: 'TechSync' }], correctAnswer: 'B', explanation: 'We also launched a new product called SecureLink for business customers.', points: 10 },
      { question: 'The company plans to close some offices.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'We do not plan to close any offices.', points: 10 },
      { question: 'What will the company focus on in 2025?', type: 'multiple_choice', options: [{ value: 'A', text: 'Closing offices' }, { value: 'B', text: 'Growing the business in Europe' }, { value: 'C', text: 'Reducing staff' }], correctAnswer: 'B', explanation: 'We will focus on growing our business in Europe.', points: 10 },
      { question: 'How many new staff are they looking for?', type: 'multiple_choice', options: [{ value: 'A', text: '20' }, { value: 'B', text: '30' }, { value: 'C', text: '50' }], correctAnswer: 'B', explanation: 'We are looking for 30 new staff, mainly in sales and customer support.', points: 10 },
      { question: 'The board is confident about future growth.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'The board is confident that the company can continue to grow.', points: 10 },
    ],
    estimatedTime: 9,
    xpReward: 80,
    time: '9m',
    practiceType: 'Report',
    length: 'Short read',
    status: 'published',
    order: 15,
  },
  {
    title: 'Weekend café helper (A2 Reading)',
    slug: 'practice-reading-a2-weekend-cafe',
    skill: 'reading',
    level: 'A2',
    category: 'practice',
    topic: 'Work',
    description: 'Read a short notice for a weekend job in a café.',
    thumbnail: '',
    content: {
      text: `WANTED: WEEKEND HELPER AT SUNSHINE CAFÉ

We need a cheerful and reliable person to help in our café on Saturdays and Sundays.

What you will do: Serve coffee and tea, prepare simple snacks, clean tables, and help in the kitchen when busy.

Hours: Saturday 8 a.m. – 2 p.m., Sunday 8 a.m. – 1 p.m.
Pay: £11 per hour. We pay every two weeks.

You should: like working with people, be punctual, and have basic English. No need for experience – we will train you.

Please send a short email to jobs@sunshinecafe.co.uk. Write your name, age, and why you want this job. We will reply within one week.

Sunshine Café – 24 High Street.`,
    },
    vocabulary: [
      { word: 'reliable', meaning: 'đáng tin cậy' },
      { word: 'punctual', meaning: 'đúng giờ' },
      { word: 'snack', meaning: 'đồ ăn nhẹ' },
    ],
    questions: [
      { question: 'Which days does the café need help?', type: 'multiple_choice', options: [{ value: 'A', text: 'Weekdays' }, { value: 'B', text: 'Saturdays and Sundays' }, { value: 'C', text: 'Fridays only' }], correctAnswer: 'B', explanation: 'To help in our café on Saturdays and Sundays.', points: 10 },
      { question: 'What time does the shift end on Sunday?', type: 'multiple_choice', options: [{ value: 'A', text: '12 p.m.' }, { value: 'B', text: '1 p.m.' }, { value: 'C', text: '2 p.m.' }], correctAnswer: 'B', explanation: 'Sunday 8 a.m. – 1 p.m.', points: 10 },
      { question: 'How much is the pay per hour?', type: 'multiple_choice', options: [{ value: 'A', text: '£10' }, { value: 'B', text: '£11' }, { value: 'C', text: '£12' }], correctAnswer: 'B', explanation: 'Pay: £11 per hour.', points: 10 },
      { question: 'Experience is required.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'false', explanation: 'No need for experience – we will train you.', points: 10 },
      { question: 'How do you apply?', type: 'multiple_choice', options: [{ value: 'A', text: 'Call the café' }, { value: 'B', text: 'Send an email to jobs@sunshinecafe.co.uk' }, { value: 'C', text: 'Go to the café in person' }], correctAnswer: 'B', explanation: 'Please send a short email to jobs@sunshinecafe.co.uk.', points: 10 },
      { question: 'What should you write in the email?', type: 'multiple_choice', options: [{ value: 'A', text: 'Only your name' }, { value: 'B', text: 'Name, age, and why you want the job' }, { value: 'C', text: 'Your CV only' }], correctAnswer: 'B', explanation: 'Write your name, age, and why you want this job.', points: 10 },
      { question: 'They will reply within one week.', type: 'true_false', options: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], correctAnswer: 'true', explanation: 'We will reply within one week.', points: 10 },
      { question: 'Where is Sunshine Café?', type: 'multiple_choice', options: [{ value: 'A', text: '24 High Street' }, { value: 'B', text: '24 Main Road' }, { value: 'C', text: 'High Street 42' }], correctAnswer: 'A', explanation: 'Sunshine Café – 24 High Street.', points: 10 },
    ],
    estimatedTime: 6,
    xpReward: 60,
    time: '6m',
    practiceType: 'Notice',
    length: 'Short read',
    status: 'published',
    order: 16,
  },
]

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.DB_NAME || 'engsocial' })
    console.log('MongoDB connected')

    for (const lesson of readingLessons) {
      const existing = await Lesson.findOne({ slug: lesson.slug })
      if (existing) {
        console.log('Skip (exists):', lesson.slug)
        continue
      }
      lesson.totalQuestions = lesson.questions.length
      await Lesson.create(lesson)
      console.log('Created:', lesson.slug)
    }

    console.log('Done. Reading lessons seeded.')
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

seed()
