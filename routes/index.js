const express = require('express');
const router = express.Router();

// ================================
// Import các route con tại đây
// ================================
// Ví dụ:
// const authRoutes = require('./auth.routes');
// const productRoutes = require('./product.routes');
// const userRoutes = require('./user.routes');

// ================================
// Đăng ký route
// ================================
// router.use('/auth', authRoutes);
// router.use('/products', productRoutes);
// router.use('/users', userRoutes);

// Route kiểm tra server đang chạy
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ Server đang hoạt động bình thường!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

module.exports = router;
