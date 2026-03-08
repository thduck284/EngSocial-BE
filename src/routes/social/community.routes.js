import { Router } from 'express'
import * as communityController from '../../controllers/community.controller.js'
import { auth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createPostSchema, updatePostSchema, createCommentSchema } from '../../validators/community.validator.js'

const router = Router()

// Posts
router.get('/posts', communityController.getPosts)
router.get('/posts/:id', communityController.getPostById)
router.post('/posts', auth, validate(createPostSchema), communityController.createPost)
router.patch('/posts/:id', auth, validate(updatePostSchema), communityController.updatePost)
router.delete('/posts/:id', auth, communityController.deletePost)
router.post('/posts/:id/like', auth, communityController.toggleLike)

// Comments
router.get('/posts/:postId/comments', communityController.getComments)
router.post('/posts/:postId/comments', auth, validate(createCommentSchema), communityController.createComment)
router.delete('/comments/:commentId', auth, communityController.deleteComment)

export default router
