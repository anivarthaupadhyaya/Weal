function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      const target = err.meta && err.meta.target;
      if (Array.isArray(target) && target.includes('email')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      if (Array.isArray(target) && target.includes('postId') && target.includes('userId')) {
        return res.status(409).json({ error: 'Post already liked by this user' });
      }
      return res.status(409).json({
        error: `Unique constraint failed on field(s): ${Array.isArray(target) ? target.join(', ') : 'unique constraint'}`
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.status(400).json({ error: 'Database request error' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
