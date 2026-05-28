import * as chatbotService from '../services/chatbot.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getConversations = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await chatbotService.getConversations(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'chatbot.listSuccess',
      data: result.conversations,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getMessages = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await chatbotService.getMessages(req.userId, req.params.conversationId, { page, limit })
    return sendSuccess(res, {
      messageKey: 'chatbot.messagesSuccess',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'chatbot.conversationNotFound' }, req)
    }
    next(error)
  }
}

export const sendMessage = async (req, res, next) => {
  try {
    const result = await chatbotService.sendMessage(req.userId, req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'chatbot.messageSent',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'chatbot.conversationNotFound' }, req)
    }
    next(error)
  }
}

/** Stream: dòng 1 JSON meta, sau đó text/plain chunk (proxy CHAT_BOT_APP hoặc chunk Gemini). */
export const sendMessageStream = async (req, res, next) => {
  try {
    await chatbotService.pipeChatStream(req.userId, req.body, res)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      if (!res.headersSent) {
        return sendError(res, { statusCode: 404, messageKey: 'chatbot.conversationNotFound' }, req)
      }
    }
    if (!res.headersSent) {
      next(error)
    } else {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }
  }
}

export const deleteConversation = async (req, res, next) => {
  try {
    await chatbotService.deleteConversation(req.userId, req.params.conversationId)
    return sendSuccess(res, { messageKey: 'chatbot.conversationDeleted' }, req)
  } catch (error) {
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'chatbot.conversationNotFound' }, req)
    }
    next(error)
  }
}
