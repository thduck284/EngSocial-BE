import * as groupService from '../services/group.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getGroups = async (req, res, next) => {
  try {
    const { type, category, search, page, limit } = req.query
    const result = await groupService.getGroups({ type, category, search, page, limit })
    return sendPaginated(res, {
      messageKey: 'group.listSuccess',
      data: result.groups,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getGroupById = async (req, res, next) => {
  try {
    const group = await groupService.getGroupById(req.params.id)
    return sendSuccess(res, {
      messageKey: 'group.detailSuccess',
      data: { group },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    next(error)
  }
}

export const createGroup = async (req, res, next) => {
  try {
    const io = req.app.get('io')
    const group = await groupService.createGroup(req.userId, req.body, io)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'group.createSuccess',
      data: { group },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateGroup = async (req, res, next) => {
  try {
    const group = await groupService.updateGroup(req.userId, req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'group.updateSuccess',
      data: { group },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN_UPDATE_GROUP') {
      return sendError(res, { statusCode: 403, messageKey: 'group.updateForbidden' }, req)
    }
    if (
      ['INVALID_GROUP_NAME', 'INVALID_GROUP_DESCRIPTION', 'INVALID_GROUP_TYPE'].includes(error.message)
    ) {
      return sendError(res, { statusCode: 400, messageKey: 'common.validationFailed' }, req)
    }
    next(error)
  }
}

export const joinGroup = async (req, res, next) => {
  try {
    const member = await groupService.joinGroup(req.userId, req.params.id)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'group.joinRequestSent',
      data: { member },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'ALREADY_MEMBER') {
      return sendError(res, { statusCode: 409, messageKey: 'group.alreadyMember' }, req)
    }
    if (error.message === 'JOIN_PENDING') {
      return sendError(res, { statusCode: 409, messageKey: 'group.joinAlreadyPending' }, req)
    }
    next(error)
  }
}

export const leaveGroup = async (req, res, next) => {
  try {
    await groupService.leaveGroup(req.userId, req.params.id)
    return sendSuccess(res, { messageKey: 'group.leaveSuccess' }, req)
  } catch (error) {
    if (error.message === 'NOT_MEMBER') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notMember' }, req)
    }
    if (error.message === 'OWNER_CANNOT_LEAVE') {
      return sendError(res, { statusCode: 400, messageKey: 'group.ownerCannotLeave' }, req)
    }
    next(error)
  }
}

export const getMembers = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await groupService.getGroupMembers(req.params.id, {
      page,
      limit,
      viewerId: req.userId || null,
    })
    return sendPaginated(res, {
      messageKey: 'group.membersSuccess',
      data: result.members,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const addMembers = async (req, res, next) => {
  try {
    const { userIds } = req.body || {}
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return sendError(res, { statusCode: 400, messageKey: 'common.validationFailed' }, req)
    }
    const io = req.app.get('io')
    const result = await groupService.addMembersToGroup(req.params.id, userIds, req.userId, io)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'group.addMembersSuccess',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    next(error)
  }
}

export const getUserGroups = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const result = await groupService.getUserGroups(req.userId, { page, limit })
    return sendPaginated(res, {
      messageKey: 'group.userGroupsSuccess',
      data: result.groups,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getJoinRequests = async (req, res, next) => {
  try {
    const { joinRequests, invitedPendingUserIds } = await groupService.getGroupJoinRequests(
      req.userId,
      req.params.id,
    )
    return sendSuccess(res, {
      messageKey: 'group.joinRequestsSuccess',
      data: { requests: joinRequests, invitedPendingUserIds },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN_JOIN_REQUESTS') {
      return sendError(res, { statusCode: 403, messageKey: 'group.joinRequestsForbidden' }, req)
    }
    next(error)
  }
}

export const approveJoinRequest = async (req, res, next) => {
  try {
    const member = await groupService.approveGroupJoinRequest(
      req.userId,
      req.params.id,
      req.params.userId,
    )
    return sendSuccess(res, {
      messageKey: 'group.joinRequestApproved',
      data: { member },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN_JOIN_REQUESTS') {
      return sendError(res, { statusCode: 403, messageKey: 'group.joinRequestsForbidden' }, req)
    }
    if (error.message === 'REQUEST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.joinRequestNotFound' }, req)
    }
    next(error)
  }
}

export const rejectJoinRequest = async (req, res, next) => {
  try {
    await groupService.rejectGroupJoinRequest(req.userId, req.params.id, req.params.userId)
    return sendSuccess(res, { messageKey: 'group.joinRequestRejected' }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN_JOIN_REQUESTS') {
      return sendError(res, { statusCode: 403, messageKey: 'group.joinRequestsForbidden' }, req)
    }
    if (error.message === 'REQUEST_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.joinRequestNotFound' }, req)
    }
    next(error)
  }
}

export const removeMember = async (req, res, next) => {
  try {
    await groupService.removeMemberFromGroup(req.userId, req.params.id, req.params.userId)
    return sendSuccess(res, { messageKey: 'group.removeMemberSuccess' }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'NOT_MEMBER') {
      return sendError(res, { statusCode: 403, messageKey: 'group.kickForbidden' }, req)
    }
    if (error.message === 'TARGET_NOT_MEMBER') {
      return sendError(res, { statusCode: 404, messageKey: 'group.targetNotMember' }, req)
    }
    if (error.message === 'FORBIDDEN_KICK') {
      return sendError(res, { statusCode: 403, messageKey: 'group.kickForbidden' }, req)
    }
    if (error.message === 'CANNOT_KICK_OWNER') {
      return sendError(res, { statusCode: 400, messageKey: 'group.cannotKickOwner' }, req)
    }
    if (error.message === 'CANNOT_KICK_SELF') {
      return sendError(res, { statusCode: 400, messageKey: 'group.cannotKickSelf' }, req)
    }
    next(error)
  }
}

export const getMyMembership = async (req, res, next) => {
  try {
    const membership = await groupService.getMyGroupMembership(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: 'group.membershipSuccess',
      data: { membership },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    next(error)
  }
}

export const acceptGroupInvite = async (req, res, next) => {
  try {
    const member = await groupService.acceptMyGroupInvite(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: 'group.inviteAcceptedSuccess',
      data: { member },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'NO_INVITE') {
      return sendError(res, { statusCode: 404, messageKey: 'group.inviteNotFound' }, req)
    }
    next(error)
  }
}

export const declineGroupInvite = async (req, res, next) => {
  try {
    await groupService.declineMyGroupInvite(req.userId, req.params.id)
    return sendSuccess(res, { messageKey: 'group.inviteDeclinedSuccess' }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'NO_INVITE') {
      return sendError(res, { statusCode: 404, messageKey: 'group.inviteNotFound' }, req)
    }
    next(error)
  }
}
