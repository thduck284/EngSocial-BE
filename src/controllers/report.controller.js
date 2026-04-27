import * as reportService from '../services/report.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

export const createContentReport = async (req, res, next) => {
  try {
    const result = await reportService.createContentReport(req.userId, req.body)
    return sendSuccess(
      res,
      {
        statusCode: 201,
        messageKey: 'report.created',
        data: result,
      },
      req
    )
  } catch (error) {
    const code = error?.message
    if (code === 'INVALID_TARGET_TYPE' || code === 'INVALID_TARGET_ID') {
      return sendError(res, { statusCode: 400, messageKey: 'report.invalidTarget' }, req)
    }
    if (code === 'REPORT_REASON_REQUIRED') {
      return sendError(res, { statusCode: 400, messageKey: 'report.reasonRequired' }, req)
    }
    if (code === 'REPORT_DUPLICATE_PENDING') {
      return sendError(res, { statusCode: 409, messageKey: 'report.duplicatePending' }, req)
    }
    if (code === 'POST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'community.postNotFound' }, req)
    }
    if (code === 'MESSAGE_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'report.messageNotFound' }, req)
    }
    if (code === 'CANNOT_REPORT_OWN_MESSAGE') {
      return sendError(res, { statusCode: 400, messageKey: 'report.cannotReportOwnMessage' }, req)
    }
    if (code === 'CANNOT_REPORT_SYSTEM_MESSAGE') {
      return sendError(res, { statusCode: 400, messageKey: 'report.cannotReportSystemMessage' }, req)
    }
    if (code === 'CONVERSATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'conversation.notFound' }, req)
    }
    if (code === 'NOT_GROUP_CONVERSATION') {
      return sendError(res, { statusCode: 400, messageKey: 'report.notGroupConversation' }, req)
    }
    if (code === 'USER_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'auth.userNotFound' }, req)
    }
    if (code === 'CANNOT_REPORT_SELF') {
      return sendError(res, { statusCode: 400, messageKey: 'report.cannotReportSelf' }, req)
    }
    if (code === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}
