const express = require('express');
const {
  getStockTransfers,
  getStockTransfer,
  createStockTransfer,
  updateStockTransfer,
  deleteStockTransfer,
  updateInventory,
  processStockTransfer
} = require('../controllers/stockTransfers');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const StockTransfer = require('../models/StockTransfer');

// Apply protection middleware to all routes
router.use(protect);

// Main routes
router
  .route('/')
  .get(
    advancedResults(StockTransfer, {
      path: 'itemId',
      select: 'name itemCode'
    }),
    getStockTransfers
  )
  .post(authorize('admin', 'user'), createStockTransfer);

// Route for processing stock transfers (previously in simpleStockTransfers)
router.route('/process').post(authorize('admin', 'user'), processStockTransfer);

router
  .route('/:id')
  .get(getStockTransfer)
  .put(authorize('admin', 'user'), updateStockTransfer)
  .delete(authorize('admin'), deleteStockTransfer);

// Route to manually update inventory for a stock transfer
router.route('/:id/update-inventory').post(authorize('admin', 'user'), updateInventory);

module.exports = router;
