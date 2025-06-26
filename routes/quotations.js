const express = require('express');
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertToSale,
  rejectQuotation,
  approveQuotation,
  markAsDelivered,
  getDeliveryUsers,
  cancelQuotation,
  approveCancellation,
  denyCancellation
} = require('../controllers/quotations');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(getQuotations)
  .post(createQuotation);

router.route('/delivery-users')
  .get(getDeliveryUsers);

router.route('/:id')
  .get(getQuotation)
  .put(updateQuotation)
  .delete(deleteQuotation);

router.route('/:id/convert')
  .post(convertToSale);

router.route('/:id/reject')
  .post(rejectQuotation);

router.route('/:id/approve')
  .post(approveQuotation);

router.route('/:id/deliver')
  .post(markAsDelivered);

router.route('/:id/cancel')
  .post(cancelQuotation);

router.route('/:id/approve-cancellation')
  .post(approveCancellation);

router.route('/:id/deny-cancellation')
  .post(denyCancellation);

module.exports = router;
