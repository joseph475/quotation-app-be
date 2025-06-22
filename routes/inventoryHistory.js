const express = require('express');
const {
  getInventoryHistory,
  getInventoryHistoryByItem,
  getInventoryHistoryByDateRange,
  getInventoryHistoryByMonth,
  getInventoryHistoryByOperation,
  createInventoryHistory,
  getMonthlyInventoryReport,
  deleteInventoryHistory
} = require('../controllers/inventoryHistory');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(getInventoryHistory)
  .post(createInventoryHistory);

router
  .route('/item/:itemId')
  .get(getInventoryHistoryByItem);

router
  .route('/date-range')
  .get(getInventoryHistoryByDateRange);

router
  .route('/month/:month')
  .get(getInventoryHistoryByMonth);

router
  .route('/operation/:operation')
  .get(getInventoryHistoryByOperation);

router
  .route('/reports/monthly/:month')
  .get(getMonthlyInventoryReport);

router
  .route('/:id')
  .delete(authorize('admin'), deleteInventoryHistory);

module.exports = router;
