import dotenv from 'dotenv'
import { Agent, fetch as undiciFetch } from 'undici'
import { GoogleGenAI } from '@google/genai'

dotenv.config()

let _geminiTlsAgent = null
let _originalFetch = null

function geminiTlsInsecureEnabled() {
  const geminiFlag = (process.env.GEMINI_TLS_INSECURE || '').trim().toLowerCase()
  if (geminiFlag === '0' || geminiFlag === 'false' || geminiFlag === 'no') return false
  if (geminiFlag === '1' || geminiFlag === 'true' || geminiFlag === 'yes') return true

  const sharedFlag = (process.env.CHAT_BOT_TLS_INSECURE || '').trim().toLowerCase()
  if (sharedFlag === '1' || sharedFlag === 'true' || sharedFlag === 'yes') return true

  return false
}

function geminiTlsAgent() {
  if (!_geminiTlsAgent) {
    _geminiTlsAgent = new Agent({
      connect: { rejectUnauthorized: false },
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
    })
  }
  return _geminiTlsAgent
}

/** Node trên Windows hay lỗi UNABLE_TO_VERIFY_LEAF_SIGNATURE khi gọi generativelanguage.googleapis.com */
function ensureGeminiFetchPatch() {
  if (!geminiTlsInsecureEnabled()) return
  if (_originalFetch) return

  _originalFetch = globalThis.fetch
  globalThis.fetch = (url, init) => {
    const urlStr = String(url)
    if (/generativelanguage\.googleapis\.com/i.test(urlStr)) {
      return undiciFetch(url, { ...init, dispatcher: geminiTlsAgent() })
    }
    return _originalFetch(url, init)
  }
}

/**
 * AI Service to handle grading and feedback using Gemini
 */
export const gradeWriting = async (prompt, studentSubmission, metadata = {}) => {
  ensureGeminiFetchPatch()

  const { level = 'B1', wordLimit = { min: 100, max: 200 } } = metadata
  
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('AI Service: GEMINI_API_KEY is missing.')
    return {
      score: 0,
      feedback: 'Hệ thống AI hiện đang bảo trì. Vui lòng thử lại sau.'
    }
  }

  const client = new GoogleGenAI({ apiKey })

  const systemInstructions = `
You are a strict English writing examiner with IELTS/Cambridge expertise.
Target CEFR level: ${level}. Word limit: ${wordLimit.min}-${wordLimit.max} words.

## SCORING METHOD (mandatory 2-phase process)

### PHASE 1 – Score each criterion independently out of 25 points:

**C1. Task Response (0-25)**
- 23-25: Fully answers all parts of the prompt with well-developed ideas
- 18-22: Addresses the prompt adequately, main ideas clear
- 13-17: Partially addresses prompt, some ideas underdeveloped
- 8-12: Prompt only partially covered, ideas unclear or off-topic
- 0-7: Barely addresses prompt or completely off-topic

**C2. Coherence & Cohesion (0-25)**
- 23-25: Smooth flow, effective linking words, clear paragraph structure (intro/body/conclusion)
- 18-22: Generally clear but minor linking issues
- 13-17: Some paragraphing but linking words repetitive or used incorrectly
- 8-12: Ideas poorly connected, hard to follow
- 0-7: No logical organisation, very hard to follow

**C3. Lexical Resource (0-25)**
- 23-25: Varied, precise vocabulary; no word repetition; natural collocations
- 18-22: Adequate vocabulary but some repetition or imprecision
- 13-17: Limited range; same words used repeatedly; some errors
- 8-12: Very limited vocabulary; many errors in word choice
- 0-7: Extremely basic vocabulary; major word choice errors throughout

**C4. Grammatical Range & Accuracy (0-25)**
- 23-25: Wide range of structures; virtually error-free
- 18-22: Mix of simple/complex; few minor errors
- 13-17: Mostly simple sentences; noticeable errors but meaning clear
- 8-12: Many grammatical errors; limited structure variety
- 0-7: Frequent major errors; very limited structures

### PHASE 2 – Final score = C1 + C2 + C3 + C4 (total 0-100)

## MANDATORY DEDUCTION RULES (apply BEFORE finalizing score):
- Submission uses MOSTLY simple SVO sentences → C4 cannot exceed 15
- More than 3 clear grammar errors → C4 cannot exceed 17
- Repetition of the same word or phrase 3+ times → C3 cannot exceed 16
- Submission is off-topic or missing parts of the prompt → C1 cannot exceed 14
- No clear intro or conclusion → C2 cannot exceed 17
- Submission is under the minimum word count → apply a -10 penalty to total

## CRITICAL CALIBRATION (the AI MUST follow this):
- A TYPICAL ${level} student submission should score between 55-72.
- Scores above 80 MUST be reserved for near-flawless writing. If there are ANY grammar errors or word repetitions, do NOT score above 78.
- DO NOT reward effort or length. Only reward quality and accuracy.
- Be honest. Students need accurate feedback to improve.

## OUTPUT FORMAT (return ONLY valid JSON, no other text):
{
  "score": <C1+C2+C3+C4 integer 0-100>,
  "breakdown": { "taskResponse": <0-25>, "coherence": <0-25>, "lexical": <0-25>, "grammar": <0-25> },
  "feedback": "Nhận xét tổng quát bằng tiếng Việt, nêu rõ điểm mạnh và điểm yếu chính...",
  "strengths": ["điểm tốt cụ thể 1", "điểm tốt cụ thể 2"],
  "improvements": ["điểm cần cải thiện cụ thể 1", "điểm cần cải thiện cụ thể 2"],
  "grammarErrors": [
    {
      "original": "câu/cụm từ gốc có lỗi",
      "correction": "câu/cụm từ đã sửa",
      "explanation": "giải thích ngắn gọn bằng tiếng Việt"
    }
  ]
}
`

  const userPrompt = `
    Đề bài (Prompt): ${prompt}
    Bài làm của học viên (Student Submission): 
    ---
    ${studentSubmission}
    ---
  `

  const modelsToTry = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
  ]

  let lastError = null
  for (const modelName of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [userPrompt],
        config: {
          systemInstruction: systemInstructions,
          responseMimeType: 'application/json',
        }
      })

      const text = response.text
      return JSON.parse(text)
    } catch (error) {
      const cause = error?.cause?.code || error?.cause?.message || ''
      console.warn(`Model ${modelName} failed, trying next...`, error.message, cause ? `(${cause})` : '')
      lastError = error
    }
  }

  // If all models fail
  console.error('All AI models failed:', lastError)
  return {
    score: 0, 
    feedback: 'Tất cả các mô hình AI hiện đang bận hoặc quá tải. Vui lòng thử lại sau. Lỗi cuối: ' + (lastError?.message || ''),
    strengths: [],
    improvements: [],
    grammarErrors: []
  }
}
