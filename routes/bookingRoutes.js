const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { preventDoubleBooking } = require('../middlewares/preventDoubleBooking');
const upload = require('../config/multer');

// ================================
// GET /checkout — Trang thanh toán (cần đăng nhập)
// ================================
router.get('/checkout', isAuthenticated, bookingController.getCheckout);

// ================================
// POST /checkout — Xác nhận đặt sân
// Middleware chain:
//   1. isAuthenticated → Kiểm tra đăng nhập
//   2. upload.single('paymentImage') → Upload ảnh bill
//   3. preventDoubleBooking → Khóa slot (ATOMIC)
//   4. bookingController.postBooking → Tạo booking
// ================================
router.post(
  '/checkout',
  isAuthenticated,
  upload.single('paymentImage'),
  preventDoubleBooking,
  bookingController.postBooking
);

// ================================
// GET /checkout/confirmation/:id — Trang xác nhận thành công
// ================================
router.get('/checkout/confirmation/:id', isAuthenticated, bookingController.getConfirmation);

// ================================
// GET /history — Lịch sử đặt sân cá nhân
// ================================
router.get('/history', isAuthenticated, bookingController.getHistory);

module.exports = router;
