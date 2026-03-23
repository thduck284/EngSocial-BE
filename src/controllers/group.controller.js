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
    const group = await groupService.createGroup(req.userId, req.body)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'group.createSuccess',
      data: { group },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const joinGroup = async (req, res, next) => {
  try {
    const member = await groupService.joinGroup(req.userId, req.params.id)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'group.joinSuccess',
      data: { member },
    }, req)
  } catch (error) {
    if (error.message === 'GROUP_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'group.notFound' }, req)
    }
    if (error.message === 'ALREADY_MEMBER') {
      return sendError(res, { statusCode: 409, messageKey: 'group.alreadyMember' }, req)
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
    const result = await groupService.getGroupMembers(req.params.id, { page, limit })
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
    const result = await groupService.addMembersToGroup(req.params.id, userIds)
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
