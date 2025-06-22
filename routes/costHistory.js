const express = require('express');
const {
  getCostHistory,
  getCostHistoryByItem,
  getCostHistoryByMonth,
  createCostHistory,
  getMonthlyCostReport,
  deleteCostHistory
} = require('../controllers/costHistory');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(getCostHistory)
  .post(createCostHistory);

router
  .route('/item/:itemId')
  .get(getCostHistoryByItem);

router
  .route('/month/:month')
  .get(getCostHistoryByMonth);

router
  .route('/reports/monthly/:month')
  .get(getMonthlyCostReport);

router
  .route('/:id')
  .delete(authorize('admin'), deleteCostHistory);

module.exports = router;
