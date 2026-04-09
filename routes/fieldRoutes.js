const express = require('express');
const router = express.Router();
const fieldController = require('../controllers/fieldController');

// ================================
// Danh sách sân bóng
// ================================
router.get('/', fieldController.getFieldList);

// ================================
// Chi tiết sân + bảng timeslot
// ================================
router.get('/:id', fieldController.getFieldDetail);

// ================================
// API: Lấy slots theo ngày (dùng cho AJAX)
// ================================
router.get('/:id/slots', fieldController.getSlotsByDate);

module.exports = router;
