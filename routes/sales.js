const express = require('express');
const {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  updatePayment
} = require('../controllers/sales');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/:id')
  .get(getSale)
  .put(updateSale)
  .delete(deleteSale);

router.route('/:id/payment')
  .put(updatePayment);

module.exports = router;
