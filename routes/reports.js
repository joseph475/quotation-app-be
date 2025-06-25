const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSalesReport,
  getInventoryReport,
  getPurchasesReport,
  getCustomersReport,
  getDeliveryReport
} = require('../controllers/reports');

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

// Allow both admin and user roles to access reports
router.use(authorize('admin', 'user', 'delivery'));

// Report routes
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/purchases', getPurchasesReport);
router.get('/customers', getCustomersReport);
router.get('/delivery', getDeliveryReport);

module.exports = router;
