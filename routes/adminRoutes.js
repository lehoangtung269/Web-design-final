const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const { uploadFieldImages } = require('../middlewares/uploadMiddleware');

// Tất cả route admin đều cần đăng nhập + role admin
router.use(isAuthenticated, authorizeRole('admin'));

// ================================
// Dashboard & Schedule
// ================================
router.get('/dashboard', adminController.getDashboard);
router.get('/schedule', adminController.getSchedule);

// ================================
// Quản lý đơn đặt sân
// ================================
router.get('/bookings', adminController.getBookings);
router.get('/bookings/:id', adminController.getBookingDetail);
router.post('/bookings/:id/approve', adminController.approveBooking);
router.post('/bookings/:id/reject', adminController.rejectBooking);

// ================================
// Quản lý sân bóng
// uploadFieldImages xử lý upload ảnh lên Cloudinary trước khi vào controller
// ================================
router.get('/fields', adminController.getFields);
router.get('/fields/create', adminController.showCreateField);
router.post('/fields', uploadFieldImages, adminController.createField);
router.get('/fields/:id/edit', adminController.showEditField);
router.post('/fields/:id', uploadFieldImages, adminController.updateField);
router.post('/fields/:id/delete', adminController.deleteField);

// ================================
// Quản lý người dùng
// ================================
router.get('/users', adminController.getUsers);
router.post('/users/:id/toggle', adminController.toggleUserStatus);

module.exports = router;
