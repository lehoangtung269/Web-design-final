const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const asyncHandler = require('../middlewares/asyncHandler');
const { uploadFieldImages } = require('../middlewares/uploadMiddleware');
const Field = require('../models/Field');

router.use(isAuthenticated, authorizeRole('field_owner'));

// Middleware: inject notification count for sidebar badge (#18)
router.use(async (req, res, next) => {
  try {
    const count = await Field.countDocuments({
      owner: req.session.user._id,
      status: { $ne: 'deleted' },
      approvalStatus: 'rejected',
    });
    res.locals.ownerNotificationCount = count;
  } catch (e) {
    res.locals.ownerNotificationCount = 0;
  }
  next();
});

router.get('/dashboard', asyncHandler(ownerController.getDashboard));
router.get('/bookings', asyncHandler(ownerController.getBookings));
router.get('/bookings/:id', asyncHandler(ownerController.getBookingDetail));
router.get('/schedule', asyncHandler(ownerController.getSchedule));
router.post('/schedule/block', asyncHandler(ownerController.blockTimeSlot));
router.post('/bookings/:id/approve', asyncHandler(ownerController.approveBooking));
router.post('/bookings/:id/reject', asyncHandler(ownerController.rejectBooking));
router.get('/fields', asyncHandler(ownerController.getFields));
router.get('/notifications', asyncHandler(ownerController.getNotifications));
router.get('/fields/create', asyncHandler(ownerController.showCreateField));
router.post('/fields', uploadFieldImages, asyncHandler(ownerController.createField));
router.get('/fields/:id/edit', asyncHandler(ownerController.showEditField));
router.post('/fields/:id', uploadFieldImages, asyncHandler(ownerController.updateField));

module.exports = router;
