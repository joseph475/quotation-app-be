const express = require('express');
const {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  searchInventory
} = require('../controllers/inventory');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(getInventory)
  .post(createInventoryItem);

// Define special routes first
router.get('/search-items', searchInventory);

// Define parameterized routes last

router.route('/:id')
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

module.exports = router;
