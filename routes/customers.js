const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customers');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;
