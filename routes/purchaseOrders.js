const express = require('express');
const {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus
} = require('../controllers/purchaseOrders');

const { getPurchaseReceivingsByPO } = require('../controllers/purchaseReceiving');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const advancedResults = require('../middleware/advancedResults');
const PurchaseOrder = require('../models/PurchaseOrder');

// Apply protection middleware to all routes
router.use(protect);

// Re-route into other resource routers
router.route('/:purchaseOrderId/receivings').get(getPurchaseReceivingsByPO);

// Main routes
router
  .route('/')
  .get(
    advancedResults(PurchaseOrder, {
      path: 'supplier',
      select: 'name email phone'
    }),
    getPurchaseOrders
  )
  .post(authorize('admin', 'user'), createPurchaseOrder);

router
  .route('/:id')
  .get(getPurchaseOrder)
  .put(authorize('admin', 'user'), updatePurchaseOrder)
  .delete(authorize('admin'), deletePurchaseOrder);

// Status update route
router
  .route('/:id/status')
  .put(authorize('admin', 'user'), updatePurchaseOrderStatus);

module.exports = router;
