const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

// Tất cả route admin đều cần đăng nhập + role admin
router.use(isAuthenticated, authorizeRole('admin'));

// ================================
// Dashboard
// ================================
router.get('/dashboard', adminController.getDashboard);

// ================================
// Quản lý đơn đặt sân
// ================================
router.get('/bookings', adminController.getBookings);
router.get('/bookings/:id', adminController.getBookingDetail);
router.post('/bookings/:id/approve', adminController.approveBooking);
router.post('/bookings/:id/reject', adminController.rejectBooking);

// ================================
// Quản lý sân bóng
// ================================
router.get('/fields', adminController.getFields);
router.get('/fields/create', adminController.showCreateField);
router.post('/fields', adminController.createField);
router.get('/fields/:id/edit', adminController.showEditField);
router.post('/fields/:id', adminController.updateField);
router.post('/fields/:id/delete', adminController.deleteField);

// ================================
// Quản lý người dùng
// ================================
router.get('/users', adminController.getUsers);
router.post('/users/:id/toggle', adminController.toggleUserStatus);

module.exports = router;
