import { Router } from 'express'
import * as communityController from '../../controllers/community.controller.js'
import { auth, optionalAuth } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createPostSchema, updatePostSchema, createCommentSchema, setReactionSchema } from '../../validators/community.validator.js'

const router = Router()

// Posts (optionalAuth: only filter visibility when viewing someone else's posts)
router.get('/posts', optionalAuth, communityController.getPosts)
router.get('/posts/:id', optionalAuth, communityController.getPostById)
router.get('/posts/:postId/documents/:index/download', optionalAuth, communityController.downloadPostDocument)
router.post('/posts', auth, validate(createPostSchema), communityController.createPost)
router.patch('/posts/:id', auth, validate(updatePostSchema), communityController.updatePost)
router.delete('/posts/:id', auth, communityController.deletePost)
router.get('/posts/:id/reactions', optionalAuth, communityController.getPostReactions)
router.get('/posts/:id/comment-users', optionalAuth, communityController.getPostCommentUsers)
router.get('/posts/:id/share-users', optionalAuth, communityController.getPostShareUsers)
router.post('/posts/:id/like', auth, communityController.toggleLike)
router.post('/posts/:id/reaction', auth, validate(setReactionSchema), communityController.setReaction)

// Comments
router.get('/posts/:postId/comments', optionalAuth, communityController.getComments)
router.post('/posts/:postId/comments', auth, validate(createCommentSchema), communityController.createComment)
router.get('/comments/:commentId/reactions', optionalAuth, communityController.getCommentReactions)
router.delete('/comments/:commentId', auth, communityController.deleteComment)
router.post('/comments/:commentId/reaction', auth, validate(setReactionSchema), communityController.setCommentReaction)

export default router
