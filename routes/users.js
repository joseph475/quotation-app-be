const express = require('express');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/users');

const router = express.Router();

// Import middleware
const { protect, authorize } = require('../middleware/auth');

// Apply protection to all routes
router.use(protect);
// Apply admin authorization to all routes
router.use(authorize('admin'));

// Define routes
router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;
