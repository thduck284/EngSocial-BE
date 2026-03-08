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
 * Upload post media (image, video, or document) - auth required
 * POST /api/upload/post-media - multipart field: file
 * Returns { data: { url, type: 'image'|'video'|'document' } }
 */
export const uploadPostMedia = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, { statusCode: 400, message: 'No file uploaded' }, req)
    }
    const { buffer, mimetype } = req.file
    const isImage = /^image\//.test(mimetype)
    const isVideo = /^video\//.test(mimetype)
    const isDoc = /^application\/(pdf|msword|vnd\.openxmlformats-officedocument)/.test(mimetype)
    let url
    let type
    if (isImage) {
      url = await uploadService.uploadImage(buffer, mimetype, 'engsocial/posts')
      type = 'image'
    } else if (isVideo) {
      url = await uploadService.uploadVideo(buffer, mimetype)
      type = 'video'
    } else if (isDoc) {
      url = await uploadService.uploadDocument(buffer, mimetype)
      type = 'document'
    } else {
      return sendError(res, { statusCode: 400, message: 'Invalid file type. Use image, video, or document.' }, req)
    }
    return sendSuccess(res, { data: { url, type } }, req)
  } catch (error) {
    next(error)
  }
}
