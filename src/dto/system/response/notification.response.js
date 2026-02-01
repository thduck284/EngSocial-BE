import { BaseDTO } from '../../base.dto.js'

export class NotificationDTO extends BaseDTO {
  constructor(notification) {
    super({
      id: notification._id?.toString() || notification.id,
      userId: notification.userId?.toString(),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      fromUserId: notification.fromUserId?.toString(),
      relatedId: notification.relatedId?.toString(),
      relatedType: notification.relatedType,
      read: notification.read,
      readAt: notification.readAt,
      data: notification.data,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    })
  }
}

export class ActivityLogDTO extends BaseDTO {
  constructor(log) {
    super({
      id: log._id?.toString() || log.id,
      userId: log.userId?.toString(),
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId?.toString(),
      metadata: log.metadata,
      xpChange: log.xpChange,
      createdAt: log.createdAt,
    })
  }
}

export class ChatbotConversationDTO extends BaseDTO {
  constructor(conversation) {
    super({
      id: conversation._id?.toString() || conversation.id,
      userId: conversation.userId?.toString(),
      title: conversation.title,
      preview: conversation.preview,
      lessonId: conversation.lessonId?.toString(),
      skill: conversation.skill,
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })
  }
}

export class ChatbotMessageDTO extends BaseDTO {
  constructor(message) {
    super({
      id: message._id?.toString() || message.id,
      conversationId: message.conversationId?.toString(),
      role: message.role,
      content: message.content,
      data: message.data,
      actions: message.actions,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    })
  }
}
