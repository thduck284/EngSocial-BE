import { Notification } from '../models/index.js'
import { NotificationDTO } from '../dto/index.js'
import { getPagination, getPaginationQuery } from '../utils/index.js'

/**
 * Get user notifications
 */
export const getNotifications = async (userId, { read, page = 1, limit = 20 }) => {
  const filter = { userId }
  if (read !== undefined) filter.read = read === 'true' || read === true

  const { skip, limit: perPage } = getPaginationQuery({ page, limit })
  const total = await Notification.countDocuments(filter)
  const unreadCount = await Notification.countDocuments({ userId, read: false })
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(perPage)

  return {
    notifications: notifications.map(n => new NotificationDTO(n)),
    unreadCount,
    pagination: getPagination({ page, limit: perPage, total }),
  }
}

/**
 * Mark notification as read
 */
export const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, userId })
  if (!notification) throw new Error('NOTIFICATION_NOT_FOUND')
  notification.read = true
  notification.readAt = new Date()
  await notification.save()
  return new NotificationDTO(notification)
}

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() },
  )
  return true
}

/**
 * Delete a notification
 */
export const deleteNotification = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, userId })
  if (!notification) throw new Error('NOTIFICATION_NOT_FOUND')
  await Notification.deleteOne({ _id: notificationId })
  return true
}

/**
 * Create a notification (internal use)
 */
export const createNotification = async ({ userId, type, title, message, fromUserId, relatedId, relatedType, data }) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    fromUserId,
    relatedId,
    relatedType,
    data,
  })
  return new NotificationDTO(notification)
}

/**
 * Get unread count
 */
export const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, read: false })
  return { unreadCount: count }
}
