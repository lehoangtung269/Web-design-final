const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const asyncHandler = require('../middlewares/asyncHandler');
const { uploadFieldImages } = require('../middlewares/uploadMiddleware');

router.use(isAuthenticated, authorizeRole('field_owner'));

router.get('/dashboard', asyncHandler(ownerController.getDashboard));
router.get('/bookings', asyncHandler(ownerController.getBookings));
router.get('/bookings/:id', asyncHandler(ownerController.getBookingDetail));
router.get('/schedule', asyncHandler(ownerController.getSchedule));
router.post('/bookings/:id/approve', asyncHandler(ownerController.approveBooking));
router.post('/bookings/:id/reject', asyncHandler(ownerController.rejectBooking));
router.get('/fields', asyncHandler(ownerController.getFields));
router.get('/notifications', asyncHandler(ownerController.getNotifications));
router.get('/fields/create', asyncHandler(ownerController.showCreateField));
router.post('/fields', uploadFieldImages, asyncHandler(ownerController.createField));
router.get('/fields/:id/edit', asyncHandler(ownerController.showEditField));
router.post('/fields/:id', uploadFieldImages, asyncHandler(ownerController.updateField));

module.exports = router;
