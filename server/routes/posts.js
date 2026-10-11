const express = require('express');
const prisma = require('../prismaClient');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function validatePost(title, content) {
  if (!title || !content) {
    throw Object.assign(new Error('Title and content are required'), { name: 'ValidationError' });
  }
  if (title.length < 3 || title.length > 200) {
    throw Object.assign(new Error('Title must be 3-200 characters'), { name: 'ValidationError' });
  }
  if (content.length < 10 || content.length > 10000) {
    throw Object.assign(new Error('Content must be 10-10000 characters'), { name: 'ValidationError' });
  }
}

function sanitizePost(post) {
  if (!post) return null;
  const isAnon = Boolean(post.isAnonymous);
  const { authorId, ...rest } = post;
  return {
    ...rest,
    author: isAnon ? null : post.author,
    authorId: isAnon ? null : authorId
  };
}

// Get all approved posts (public)
router.get('/', async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { comments: true, likes: true }
        },
        author: {
          select: { id: true, name: true }
        }
      }
    });

    const sanitizedPosts = posts.map(sanitizePost);

    res.json({ posts: sanitizedPosts });
  } catch (error) {
    next(error);
  }
});

// Get single post by ID (public)
router.get('/:id', async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: { id: true, name: true }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: { likes: true }
        }
      }
    });

    if (!post || post.status !== 'APPROVED') {
      throw Object.assign(new Error('Post not found'), { name: 'ValidationError' });
    }

    res.json({
      post: sanitizePost(post)
    });
  } catch (error) {
    next(error);
  }
});

// Create post (authenticated)
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, content, isAnonymous } = req.body;

    validatePost(title, content);

    const defaultStatus = process.env.AUTO_APPROVE_POSTS === 'false' ? 'PENDING' : 'APPROVED';

    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        isAnonymous: isAnonymous || false,
        status: defaultStatus,
        authorId: req.user.userId
      },
      include: {
        author: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({
      post: sanitizePost(post)
    });
  } catch (error) {
    next(error);
  }
});

// Update user's own post (authenticated)
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const postId = req.params.id;

    validatePost(title, content);

    const existingPost = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!existingPost || existingPost.authorId !== req.user.userId) {
      throw Object.assign(new Error('Post not found or unauthorized'), { name: 'ValidationError' });
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        title: title.trim(),
        content: content.trim()
      },
      include: {
        author: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      post: sanitizePost(post)
    });
  } catch (error) {
    next(error);
  }
});

// Delete user's own post (authenticated)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const postId = req.params.id;

    const existingPost = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!existingPost || existingPost.authorId !== req.user.userId) {
      throw Object.assign(new Error('Post not found or unauthorized'), { name: 'ValidationError' });
    }

    await prisma.post.delete({
      where: { id: postId }
    });

    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

// Get current user's posts (authenticated)
router.get('/user/my-posts', authenticateToken, async (req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { authorId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { comments: true, likes: true }
        }
      }
    });

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

// Update post status (moderation)
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const postId = req.params.id;

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw Object.assign(new Error('Invalid status. Must be PENDING, APPROVED, or REJECTED'), { name: 'ValidationError' });
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: { status },
      include: {
        author: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({ post: sanitizePost(post) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
