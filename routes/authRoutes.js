const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest } = require('../middlewares/authMiddleware');

// ================================
// Trang Đăng ký
// ================================
router.get('/register', isGuest, authController.showRegister);
router.post('/register', isGuest, authController.register);

// ================================
// Trang Đăng nhập
// ================================
router.get('/login', isGuest, authController.showLogin);
router.post('/login', isGuest, authController.login);

// ================================
// Đăng xuất
// ================================
router.get('/logout', authController.logout);

module.exports = router;
