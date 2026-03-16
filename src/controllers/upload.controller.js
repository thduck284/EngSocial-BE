import * as uploadService from '../services/upload.service.js'
import { sendSuccess, sendError } from '../dto/index.js'

/**
 * Upload asset for lesson (thumbnail image or audio)
 * POST /api/upload/asset - multipart field: file
 * Returns { data: { url } }
 */
export const uploadAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, { statusCode: 400, message: 'No file uploaded' }, req)
    }
    const { buffer, mimetype } = req.file
    const isImage = /^image\//.test(mimetype)
    const isAudio = /^audio\//.test(mimetype)
    let url
    if (isImage) {
      url = await uploadService.uploadImage(buffer, mimetype)
    } else if (isAudio) {
      url = await uploadService.uploadAudio(buffer, mimetype)
    } else {
      return sendError(res, { statusCode: 400, message: 'Invalid file type. Use image or audio.' }, req)
    }
    return sendSuccess(res, { data: { url } }, req)
  } catch (error) {
    next(error)
  }
}

/**
 * Upload post media (image, video, audio, or document) - auth required
 * POST /api/upload/post-media - multipart field: file
 * Returns { data: { url, type: 'image'|'video'|'audio'|'document', name?: string } }
 * name = original filename for document (and optional for others)
 */
export const uploadPostMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, { statusCode: 400, message: 'No file uploaded' }, req)
    }
    const { buffer, mimetype, originalname } = req.file
    const isImage = /^image\//.test(mimetype)
    const isVideo = /^video\//.test(mimetype)
    const isAudio = /^audio\//.test(mimetype)
    const isDoc = /^application\/(pdf|msword|vnd\.openxmlformats-officedocument|vnd\.ms-excel)/.test(mimetype)
    let url
    let type
    if (isImage) {
      url = await uploadService.uploadImage(buffer, mimetype, 'engsocial/posts')
      type = 'image'
    } else if (isVideo) {
      url = await uploadService.uploadVideo(buffer, mimetype)
      type = 'video'
    } else if (isAudio) {
      url = await uploadService.uploadAudio(buffer, mimetype, 'engsocial/posts')
      type = 'audio'
    } else if (isDoc) {
      url = await uploadService.uploadDocument(buffer, mimetype)
      type = 'document'
    } else {
      return sendError(res, { statusCode: 400, message: 'Invalid file type. Use image, video, audio, or document.' }, req)
    }
    const data = { url, type }
    if (originalname && typeof originalname === 'string') data.name = originalname
    return sendSuccess(res, { data }, req)
  } catch (error) {
    next(error)
  }
}
