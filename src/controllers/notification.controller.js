import * as notificationService from '../services/notification.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getNotifications = async (req, res, next) => {
  try {
    const { read, page, limit } = req.query
    const result = await notificationService.getNotifications(req.userId, { read, page, limit })
    return sendPaginated(res, {
      messageKey: 'notification.listSuccess',
      data: { notifications: result.notifications, unreadCount: result.unreadCount },
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.userId)
    return sendSuccess(res, {
      messageKey: 'notification.countSuccess',
      data: result,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: 'notification.markedRead',
      data: { notification },
    }, req)
  } catch (error) {
    if (error.message === 'NOTIFICATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'notification.notFound' }, req)
    }
    next(error)
  }
}

export const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.userId)
    return sendSuccess(res, { messageKey: 'notification.allMarkedRead' }, req)
  } catch (error) {
    next(error)
  }
}

export const deleteNotification = async (req, res, next) => {
  try {
    await notificationService.deleteNotification(req.userId, req.params.id)
    return sendSuccess(res, { messageKey: 'notification.deleted' }, req)
  } catch (error) {
    if (error.message === 'NOTIFICATION_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'notification.notFound' }, req)
    }
    next(error)
  }
}
