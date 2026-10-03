import Joi from 'joi'

const wordPattern = /^[a-zA-Z]+$/

export const createWordScrambleSchema = Joi.object({
  word: Joi.string().required().min(3).max(80).pattern(wordPattern).messages({
    'string.pattern.base': 'Word must be letters only (no spaces)',
  }),
  meaning: Joi.string().required().max(500).trim(),
  example: Joi.string().allow('').max(1000),
  synonyms: Joi.array().items(Joi.string().allow('')),
  antonyms: Joi.array().items(Joi.string().allow('')),
  sentenceTemplate: Joi.string().allow('').max(1000),
  wrongSentence: Joi.string().allow('').max(1000),
  wrongWord: Joi.string().allow('').max(100),
  emoji: Joi.string().allow('').max(50),
  difficulty: Joi.string().required().valid('easy', 'medium', 'hard'),
  topic: Joi.string().allow('').max(100).trim(),
  isActive: Joi.boolean(),
})

export const updateWordScrambleSchema = Joi.object({
  word: Joi.string().min(3).max(80).pattern(wordPattern),
  meaning: Joi.string().max(500).trim(),
  example: Joi.string().allow('').max(1000),
  synonyms: Joi.array().items(Joi.string().allow('')),
  antonyms: Joi.array().items(Joi.string().allow('')),
  sentenceTemplate: Joi.string().allow('').max(1000),
  wrongSentence: Joi.string().allow('').max(1000),
  wrongWord: Joi.string().allow('').max(100),
  emoji: Joi.string().allow('').max(50),
  difficulty: Joi.string().valid('easy', 'medium', 'hard'),
  topic: Joi.string().allow('').max(100).trim(),
  isActive: Joi.boolean(),
}).or('word', 'meaning', 'example', 'difficulty', 'topic', 'isActive', 'synonyms', 'antonyms', 'sentenceTemplate', 'wrongSentence', 'wrongWord', 'emoji')

/** Paste nguyên nội dung file .tsv (có header) */
export const importWordScrambleTsvSchema = Joi.object({
  tsv: Joi.string().required().max(5_000_000),
})
