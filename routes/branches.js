const express = require('express');
const {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  searchBranches
} = require('../controllers/branches');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const Branch = require('../models/Branch');

// Apply protection middleware to all routes
router.use(protect);

// Search route
router.route('/search').get(searchBranches);

// Main routes
router
  .route('/')
  .get(advancedResults(Branch), getBranches)
  .post(authorize('admin'), createBranch);

router
  .route('/:id')
  .get(getBranch)
  .put(authorize('admin'), updateBranch)
  .delete(authorize('admin'), deleteBranch);

module.exports = router;
