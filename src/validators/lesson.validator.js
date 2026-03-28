import Joi from 'joi'

export const createLessonSchema = Joi.object({
  title: Joi.string().required().max(200).trim(),
  skill: Joi.string().required().valid('reading', 'listening', 'writing'),
  level: Joi.string().required().valid('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
  topic: Joi.string().max(200).trim(),
  description: Joi.string().max(1000),
  thumbnail: Joi.string().max(2000),
  content: Joi.object({
    text: Joi.string(),
    wordCount: Joi.number().integer(),
    audioUrl: Joi.string(),
    transcript: Joi.string(),
    duration: Joi.number().integer(),
    accent: Joi.string().valid('american', 'british', 'australian'),
    speed: Joi.number().min(0.5).max(2.0),
    chapters: Joi.array().items(Joi.object({
      id: Joi.string(),
      label: Joi.string(),
      time: Joi.string(),
      startTime: Joi.number().integer(),
    })),
    prompt: Joi.string(),
    wordLimit: Joi.object({
      min: Joi.number().integer(),
      max: Joi.number().integer(),
    }),
    sampleAnswer: Joi.string(),
  }),
  questions: Joi.array().items(Joi.object({
    id: Joi.string(),
    question: Joi.string().required(),
    type: Joi.string().required().valid('multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering'),
    options: Joi.array().items(Joi.object({
      value: Joi.string(),
      text: Joi.string(),
    })),
    correctAnswer: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())),
    explanation: Joi.string(),
    points: Joi.number().integer().default(10),
  })),
  vocabulary: Joi.array().items(Joi.object({
    word: Joi.string(),
    phonetic: Joi.string(),
    meaning: Joi.string(),
    meaningVi: Joi.string(),
    example: Joi.string(),
    audioUrl: Joi.string(),
  })),
  estimatedTime: Joi.number().integer(),
  xpReward: Joi.number().integer().default(50),
  status: Joi.string().valid('published'),
  featured: Joi.boolean(),
  tags: Joi.array().items(Joi.string()),
})

export const updateLessonSchema = Joi.object({
  title: Joi.string().max(200).trim(),
  skill: Joi.string().valid('reading', 'listening', 'writing'),
  level: Joi.string().valid('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
  topic: Joi.string().max(200).trim(),
  description: Joi.string().max(1000),
  thumbnail: Joi.string().max(2000),
  content: Joi.object(),
  questions: Joi.array(),
  vocabulary: Joi.array(),
  estimatedTime: Joi.number().integer(),
  xpReward: Joi.number().integer(),
  status: Joi.string().valid('published'),
  featured: Joi.boolean(),
  tags: Joi.array().items(Joi.string()),
}).min(1)

export const submitAnswersSchema = Joi.object({
  answers: Joi.array().items(Joi.object({
    questionId: Joi.string().required(),
    answer: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
  })).required().min(1),
  timeSpent: Joi.number().integer().min(0),
})

export const submitWritingSchema = Joi.object({
  content: Joi.string().required().min(1),
  wordCount: Joi.number().integer(),
})
