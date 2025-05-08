const express = require('express');
const {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  searchSuppliers
} = require('../controllers/suppliers');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Supplier = require('../models/Supplier');

// Apply protection middleware to all routes
router.use(protect);

// Search route
router.route('/search').get(searchSuppliers);

// Main routes
router
  .route('/')
  .get(advancedResults(Supplier), getSuppliers)
  .post(authorize('admin', 'user'), createSupplier);

router
  .route('/:id')
  .get(getSupplier)
  .put(authorize('admin', 'user'), updateSupplier)
  .delete(authorize('admin'), deleteSupplier);

module.exports = router;
