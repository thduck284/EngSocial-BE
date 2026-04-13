import dotenv from 'dotenv'
import { GoogleGenAI } from '@google/genai'

dotenv.config()

/**
 * AI Service to handle grading and feedback using Gemini
 */
export const gradeWriting = async (prompt, studentSubmission, metadata = {}) => {
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
    Bạn là một chuyên gia khảo thí tiếng Anh (IELTS/Cambridge expert). 
    Nhiệm vụ của bạn là chấm điểm bài viết tiếng Anh của học viên dựa trên các tiêu chí chuyên nghiệp.
    Trình độ mục tiêu: ${level}. Giới hạn từ: ${wordLimit.min}-${wordLimit.max} từ.
    
    Hướng dẫn chấm điểm:
    1. Điểm số (score): Trên thang điểm 0-100. Đánh giá dựa trên:
       - Task Response (Đúng đề tài, đủ ý)
       - Coherence and Cohesion (Mạch lạc, liên kết)
       - Lexical Resource (Từ vựng phong phú, chính xác)
       - Grammatical Range and Accuracy (Ngữ pháp đa dạng, chính xác)
    2. Phản hồi (feedback): Cung cấp nhận xét chi tiết bằng TIẾNG VIỆT.
    3. Điểm mạnh (strengths): Liệt kê các điểm tốt của bài viết.
    4. Cần cải thiện (improvements): Các điểm cần khắc phục.
    5. Lỗi ngữ pháp & gợi ý (grammarErrors): 
       - Tìm các lỗi ngữ pháp, dùng từ sai, hoặc các cách diễn đạt chưa tự nhiên.
       - Cung cấp: văn bản gốc, cách sửa lại đúng/hay hơn, và giải thích ngắn gọn bằng tiếng Việt.
    
    Yêu cầu quan trọng:
    - Phản hồi phải mang tính xây dựng, khích lệ nhưng vẫn trung thực.
    - Cấu trúc phản hồi PHẢI LUÔN LÀ JSON như sau:
    {
      "score": number (0-100),
      "feedback": "Nhận xét tổng quát bằng tiếng Việt...",
      "strengths": ["điểm tốt 1", "điểm tốt 2", ...],
      "improvements": ["điểm cần cải thiện 1", "điểm cần cải thiện 2", ...],
      "grammarErrors": [
        {
          "original": "đoạn văn bản gốc có lỗi",
          "correction": "đoạn văn bản đã sửa lại",
          "explanation": "giải thích lý do sửa bằng tiếng Việt"
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
    'gemini-3-flash-preview', 
    'gemini-2.5-flash', 
    'gemini-2.0-flash', 
    'gemini-1.5-flash'
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
      console.warn(`Model ${modelName} failed, trying next...`, error.message)
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
