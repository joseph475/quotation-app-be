const express = require('express');
const {
  getDashboardSummary,
  getRecentSales,
  getLowStockItems,
  getTopSellingItems
} = require('../controllers/dashboard');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.get('/summary', getDashboardSummary);
router.get('/recent-sales', getRecentSales);
router.get('/low-stock', getLowStockItems);
router.get('/top-selling', getTopSellingItems);

module.exports = router;
