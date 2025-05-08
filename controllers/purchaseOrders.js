const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');

// @desc    Get all purchase orders
// @route   GET /api/v1/purchase-orders
// @access  Private
exports.getPurchaseOrders = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single purchase order
// @route   GET /api/v1/purchase-orders/:id
// @access  Private
exports.getPurchaseOrder = asyncHandler(async (req, res, next) => {
  const purchaseOrder = await PurchaseOrder.findById(req.params.id);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: purchaseOrder
  });
});

// @desc    Create new purchase order
// @route   POST /api/v1/purchase-orders
// @access  Private
exports.createPurchaseOrder = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  // If branch is not provided, use the user's branch
  if (!req.body.branch) {
    if (req.user.branch) {
      req.body.branch = req.user.branch;
    } else {
      return next(
        new ErrorResponse('Please add a branch. User does not have a default branch assigned.', 400)
      );
    }
  }

  // Check if supplier exists
  const supplier = await Supplier.findById(req.body.supplier);
  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${req.body.supplier}`, 404)
    );
  }

  // Generate order number if not provided
  if (!req.body.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get the latest purchase order to increment the number
    const latestPO = await PurchaseOrder.findOne().sort('-createdAt');
    let nextNumber = 1;
    
    if (latestPO && latestPO.orderNumber) {
      // Extract the number part from the latest PO number (assuming format PO-YYYY-MM-XXXX)
      const parts = latestPO.orderNumber.split('-');
      if (parts.length === 4) {
        nextNumber = parseInt(parts[3]) + 1;
      }
    }
    
    req.body.orderNumber = `PO-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
  }

  // Calculate totals
  let subtotal = 0;
  if (req.body.items && req.body.items.length > 0) {
    req.body.items.forEach(item => {
      item.total = item.quantity * item.unitPrice;
      subtotal += item.total;
    });
  }

  req.body.subtotal = subtotal;
  req.body.totalAmount = subtotal + (req.body.taxAmount || 0) - (req.body.discountAmount || 0);

  const purchaseOrder = await PurchaseOrder.create(req.body);

  res.status(201).json({
    success: true,
    data: purchaseOrder
  });
});

// @desc    Update purchase order
// @route   PUT /api/v1/purchase-orders/:id
// @access  Private
exports.updatePurchaseOrder = asyncHandler(async (req, res, next) => {
  let purchaseOrder = await PurchaseOrder.findById(req.params.id);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if supplier exists if supplier is being updated
  if (req.body.supplier) {
    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier) {
      return next(
        new ErrorResponse(`Supplier not found with id of ${req.body.supplier}`, 404)
      );
    }
  }

  // If branch is being explicitly set to null or undefined, check if user has a branch
  if (req.body.hasOwnProperty('branch') && !req.body.branch) {
    if (req.user.branch) {
      req.body.branch = req.user.branch;
    } else {
      return next(
        new ErrorResponse('Please add a branch. User does not have a default branch assigned.', 400)
      );
    }
  }

  // Recalculate totals if items are being updated
  if (req.body.items && req.body.items.length > 0) {
    let subtotal = 0;
    req.body.items.forEach(item => {
      item.total = item.quantity * item.unitPrice;
      subtotal += item.total;
    });
    
    req.body.subtotal = subtotal;
    req.body.totalAmount = subtotal + (req.body.taxAmount || purchaseOrder.taxAmount || 0) - 
                          (req.body.discountAmount || purchaseOrder.discountAmount || 0);
  }

  purchaseOrder = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: purchaseOrder
  });
});

// @desc    Delete purchase order
// @route   DELETE /api/v1/purchase-orders/:id
// @access  Private
exports.deletePurchaseOrder = asyncHandler(async (req, res, next) => {
  const purchaseOrder = await PurchaseOrder.findById(req.params.id);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if purchase order can be deleted (e.g., not already received)
  if (purchaseOrder.status === 'Completed') {
    return next(
      new ErrorResponse(`Cannot delete a completed purchase order`, 400)
    );
  }

  await purchaseOrder.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Update purchase order status
// @route   PUT /api/v1/purchase-orders/:id/status
// @access  Private
exports.updatePurchaseOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return next(new ErrorResponse('Please provide a status', 400));
  }

  let purchaseOrder = await PurchaseOrder.findById(req.params.id);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.id}`, 404)
    );
  }

  purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
    req.params.id,
    { status },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: purchaseOrder
  });
});
