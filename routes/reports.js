const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSalesReport,
  getInventoryReport,
  getPurchasesReport,
  getCustomersReport
} = require('../controllers/reports');

const router = express.Router();

// Protect all routes - require authentication
router.use(protect);

// Restrict to admin role
router.use(authorize('admin'));

// Report routes
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/purchases', getPurchasesReport);
router.get('/customers', getCustomersReport);

module.exports = router;
