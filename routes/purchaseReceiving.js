const express = require('express');
const {
  getPurchaseReceivings,
  getPurchaseReceiving,
  createPurchaseReceiving,
  updatePurchaseReceiving,
  deletePurchaseReceiving
} = require('../controllers/purchaseReceiving');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const PurchaseReceiving = require('../models/PurchaseReceiving');

// Apply protection middleware to all routes
router.use(protect);

// Main routes
router
  .route('/')
  .get(
    advancedResults(PurchaseReceiving, [
      {
        path: 'purchaseOrder',
        select: 'orderNumber orderDate expectedDeliveryDate'
      },
      {
        path: 'supplier',
        select: 'name email phone'
      }
    ]),
    getPurchaseReceivings
  )
  .post(authorize('admin', 'user'), createPurchaseReceiving);

router
  .route('/:id')
  .get(getPurchaseReceiving)
  .put(authorize('admin', 'user'), updatePurchaseReceiving)
  .delete(authorize('admin'), deletePurchaseReceiving);

module.exports = router;
