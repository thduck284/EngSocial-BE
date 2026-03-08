import cloudinary from '../config/cloudinary.js'
import * as authService from './auth.service.js'

/**
 * Upload avatar image to Cloudinary and update user profile
 * @param {string} userId
 * @param {Buffer} buffer - file buffer
 * @param {string} mimetype - e.g. image/jpeg
 * @returns {Promise<{ user }>}
 */
export const uploadAvatar = async (userId, buffer, mimetype) => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'engsocial/avatars',
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  })

  const url = result.secure_url
  const user = await authService.updateUserProfile(userId, { avatar: url })
  return { user }
}

/**
 * Upload image (thumbnail, etc.) for lessons/practices - returns URL
 */
export const uploadImage = async (buffer, mimetype, folder = 'engsocial/lessons') => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    transformation: [{ width: 800, crop: 'limit' }],
  })
  return result.secure_url
}

/**
 * Upload audio for listening lessons - returns URL
 */
export const uploadAudio = async (buffer, mimetype, folder = 'engsocial/audio') => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'auto',
  })
  return result.secure_url
}

/**
 * Upload video for posts - returns URL
 */
export const uploadVideo = async (buffer, mimetype, folder = 'engsocial/posts') => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'video',
  })
  return result.secure_url
}

/**
 * Upload document (PDF, DOC, etc.) as raw - returns URL
 */
export const uploadDocument = async (buffer, mimetype, folder = 'engsocial/documents') => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'raw',
  })
  return result.secure_url
}

const imageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
/** Video mimetypes for message attachments (MOV, AVI, etc. go through uploadVideo) */
const videoMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']
/** Audio mimetypes for message attachments (.mp3, .wav, etc.) */
const audioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg']

/**
 * Upload message attachment (image, video, audio, or document) - returns URL
 */
export const uploadMessageAttachment = async (buffer, mimetype, originalName) => {
  const folder = 'engsocial/messages'
  const mime = (mimetype || '').toLowerCase()
  if (imageMimes.includes(mime) || mime.startsWith('image/')) {
    return uploadImage(buffer, mimetype, folder)
  }
  if (videoMimes.includes(mime) || mime.startsWith('video/')) {
    return uploadVideo(buffer, mimetype, folder)
  }
  if (audioMimes.includes(mime) || mime.startsWith('audio/')) {
    return uploadAudio(buffer, mimetype, folder)
  }
  return uploadDocument(buffer, mimetype, folder)
}
