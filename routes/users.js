const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserRoleStats
} = require('../controllers/users');

const router = express.Router();

// Import middleware
const { protect, authorize } = require('../middleware/auth');

// Apply protection to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(authorize('admin'), getUsers)
  .post(authorize('admin'), createUser);

// Statistics route (must be before /:id route to avoid conflicts)
router.route('/stats/roles')
  .get(authorize('admin'), getUserRoleStats);

router.route('/:id')
  .get(getUser) // Allow all authenticated users to access this route
  .put(authorize('admin'), updateUser)
  .delete(authorize('admin'), deleteUser);

module.exports = router;
