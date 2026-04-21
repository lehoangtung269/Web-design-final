const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const checkOwnership = require('../middlewares/ownership');
const asyncHandler = require('../middlewares/asyncHandler');

router.use(isAuthenticated, authorizeRole('field_owner'));

router.get('/dashboard', asyncHandler(ownerController.getDashboard));
router.get('/bookings', asyncHandler(ownerController.getBookings));
router.post('/bookings/:id/approve', asyncHandler(ownerController.approveBooking));
router.post('/bookings/:id/reject', asyncHandler(ownerController.rejectBooking));
router.get('/fields', asyncHandler(ownerController.getFields));

module.exports = router;
