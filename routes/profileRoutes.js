const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// ================================
// GET /profile — Trang hồ sơ cá nhân
// ================================
router.get('/profile', isAuthenticated, profileController.getProfile);

// ================================
// POST /profile/update — Cập nhật thông tin
// ================================
router.post('/profile/update', isAuthenticated, profileController.updateProfile);

// ================================
// POST /profile/change-password — Đổi mật khẩu
// ================================
router.post('/profile/change-password', isAuthenticated, profileController.changePassword);

module.exports = router;
