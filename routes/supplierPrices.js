const express = require('express');
const {
  getSupplierPrices,
  getSupplierPrice,
  createSupplierPrice,
  updateSupplierPrice,
  deleteSupplierPrice,
  getSupplierPricesBySupplier,
  getSupplierPricesByItem,
  updateSupplierPrices
} = require('../controllers/supplierPrices');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const SupplierPrice = require('../models/SupplierPrice');

// Apply protection middleware to all routes
router.use(protect);

// Routes for supplier-specific prices
router
  .route('/supplier/:supplierId')
  .get(getSupplierPricesBySupplier)
  .put(authorize('admin', 'user'), updateSupplierPrices);

// Routes for item-specific prices
router
  .route('/item/:itemId')
  .get(getSupplierPricesByItem);

// Main routes
router
  .route('/')
  .get(advancedResults(SupplierPrice, [
    { path: 'supplier', select: 'name' },
    { path: 'inventory', select: 'name itemCode' }
  ]), getSupplierPrices)
  .post(authorize('admin', 'user'), createSupplierPrice);

router
  .route('/:id')
  .get(getSupplierPrice)
  .put(authorize('admin', 'user'), updateSupplierPrice)
  .delete(authorize('admin'), deleteSupplierPrice);

module.exports = router;
