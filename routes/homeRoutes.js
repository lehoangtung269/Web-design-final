const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

// ================================
// Trang chủ
// ================================
router.get('/', homeController.getHomePage);

// ================================
// Tìm kiếm sân
// ================================
router.get('/search', homeController.searchFields);

module.exports = router;
