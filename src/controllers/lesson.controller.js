import * as lessonService from '../services/lesson.service.js'
import { sendSuccess, sendError, sendPaginated } from '../dto/index.js'

export const getLessons = async (req, res, next) => {
  try {
    const { skill, level, status, search, featured, page, limit } = req.query
    const result = await lessonService.getLessons({ skill, level, status, search, featured, page, limit })
    return sendPaginated(res, {
      messageKey: 'lesson.listSuccess',
      data: result.lessons,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getLessonBySlug = async (req, res, next) => {
  try {
    const lesson = await lessonService.getLessonBySlug(req.params.slug)
    return sendSuccess(res, {
      messageKey: 'lesson.detailSuccess',
      data: { lesson },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

export const getLessonById = async (req, res, next) => {
  try {
    const lesson = await lessonService.getLessonById(req.params.id)
    return sendSuccess(res, {
      messageKey: 'lesson.detailSuccess',
      data: { lesson },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

export const createLesson = async (req, res, next) => {
  try {
    const lesson = await lessonService.createLesson(req.body, req.userId)
    return sendSuccess(res, {
      statusCode: 201,
      messageKey: 'lesson.createSuccess',
      data: { lesson },
    }, req)
  } catch (error) {
    next(error)
  }
}

export const updateLesson = async (req, res, next) => {
  try {
    const lesson = await lessonService.updateLesson(req.params.id, req.body, req.userId)
    return sendSuccess(res, {
      messageKey: 'lesson.updateSuccess',
      data: { lesson },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

export const deleteLesson = async (req, res, next) => {
  try {
    await lessonService.deleteLesson(req.params.id, req.userId)
    return sendSuccess(res, { messageKey: 'lesson.deleteSuccess' }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    if (error.message === 'FORBIDDEN') {
      return sendError(res, { statusCode: 403, messageKey: 'common.forbidden' }, req)
    }
    next(error)
  }
}

export const startLesson = async (req, res, next) => {
  try {
    const result = await lessonService.startLesson(req.userId, req.params.id)
    return sendSuccess(res, {
      messageKey: 'lesson.startSuccess',
      data: result,
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

export const submitAnswers = async (req, res, next) => {
  try {
    const progress = await lessonService.submitAnswers(req.userId, req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'lesson.submitSuccess',
      data: { progress },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

export const submitWriting = async (req, res, next) => {
  try {
    const progress = await lessonService.submitWriting(req.userId, req.params.id, req.body)
    return sendSuccess(res, {
      messageKey: 'lesson.submitSuccess',
      data: { progress },
    }, req)
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') {
      return sendError(res, { statusCode: 404, messageKey: 'lesson.notFound' }, req)
    }
    next(error)
  }
}

export const getUserProgress = async (req, res, next) => {
  try {
    const { skill, status, page, limit } = req.query
    const result = await lessonService.getUserProgress(req.userId, { skill, status, page, limit })
    return sendPaginated(res, {
      messageKey: 'lesson.progressSuccess',
      data: result.progress,
      pagination: result.pagination,
    }, req)
  } catch (error) {
    next(error)
  }
}

export const getUserSkillStats = async (req, res, next) => {
  try {
    const stats = await lessonService.getUserSkillStats(req.userId)
    return sendSuccess(res, {
      messageKey: 'lesson.skillStatsSuccess',
      data: { stats },
    }, req)
  } catch (error) {
    next(error)
  }
}
