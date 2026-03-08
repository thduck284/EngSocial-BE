import multer from 'multer'

const storage = multer.memoryStorage()

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('INVALID_IMAGE_TYPE'), false)
  }
}

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
}).single('avatar')

const imageOrAudioFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('INVALID_FILE_TYPE'), false)
  }
}

export const uploadLessonAsset = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for audio
  fileFilter: imageOrAudioFilter,
}).single('file')

const postMediaTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const postMediaFilter = (req, file, cb) => {
  if (postMediaTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('INVALID_POST_MEDIA_TYPE'), false)
  }
}

export const uploadPostMedia = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for video
  fileFilter: postMediaFilter,
}).single('file')
