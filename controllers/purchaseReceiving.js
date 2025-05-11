const mongoose = require('mongoose');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const PurchaseReceiving = require('../models/PurchaseReceiving');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');

// @desc    Get all purchase receivings
// @route   GET /api/v1/purchase-receiving
// @access  Private
exports.getPurchaseReceivings = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single purchase receiving
// @route   GET /api/v1/purchase-receiving/:id
// @access  Private
exports.getPurchaseReceiving = asyncHandler(async (req, res, next) => {
  const purchaseReceiving = await PurchaseReceiving.findById(req.params.id);

  if (!purchaseReceiving) {
    return next(
      new ErrorResponse(`Purchase receiving not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: purchaseReceiving
  });
});

// @desc    Create new purchase receiving
// @route   POST /api/v1/purchase-receiving
// @access  Private
exports.createPurchaseReceiving = asyncHandler(async (req, res, next) => {
  // Remove _id field if present to let MongoDB generate it
  if (req.body._id !== undefined) {
    delete req.body._id;
  }
  
  // Remove any _id fields from items array to prevent casting errors
  if (req.body.items && Array.isArray(req.body.items)) {
    req.body.items = req.body.items.map(item => {
      // Create a new object without the _id field
      const { _id, ...itemWithoutId } = item;
      return itemWithoutId;
    });
  }
  
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

  // Check if purchase order exists
  const purchaseOrder = await PurchaseOrder.findById(req.body.purchaseOrder);
  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.body.purchaseOrder}`, 404)
    );
  }

  // Get existing receiving records for this purchase order (for reference only)
  const existingReceivings = await PurchaseReceiving.find({ purchaseOrder: req.body.purchaseOrder });
  console.log(`Found ${existingReceivings.length} existing receiving records for purchase order ${req.body.purchaseOrder}`);

  // Set supplier from purchase order
  req.body.supplier = purchaseOrder.supplier;

  // Generate receiving number if not provided
  if (!req.body.receivingNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Use a more robust approach to generate a unique receiving number
    // Find the highest number for the current year and month
    const regex = new RegExp(`^GR-${year}-${month}-\\d{4}$`);
    const existingReceivings = await PurchaseReceiving.find({ 
      receivingNumber: regex 
    }).sort('-receivingNumber');
    
    let nextNumber = 1;
    
    if (existingReceivings.length > 0) {
      // Extract the number part from the highest receiving number
      const parts = existingReceivings[0].receivingNumber.split('-');
      if (parts.length === 4) {
        nextNumber = parseInt(parts[3]) + 1;
      }
    }
    
    req.body.receivingNumber = `GR-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
    
    // Double-check that this receiving number doesn't already exist
    // This handles edge cases in case of concurrent requests
    const duplicateCheck = await PurchaseReceiving.findOne({ 
      receivingNumber: req.body.receivingNumber 
    });
    
    if (duplicateCheck) {
      // If we found a duplicate, increment the number and try again
      nextNumber++;
      req.body.receivingNumber = `GR-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
    }
  }

  // Validate items
  if (!req.body.items || req.body.items.length === 0) {
    return next(new ErrorResponse('Please add at least one item to receive', 400));
  }

  // Process each item
  for (const item of req.body.items) {
    // Validate purchaseOrderItem is not empty and is a valid ObjectId
    if (!item.purchaseOrderItem || item.purchaseOrderItem === '') {
      return next(
        new ErrorResponse(`Purchase order item reference cannot be empty`, 400)
      );
    }

    // Check if it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(item.purchaseOrderItem)) {
      return next(
        new ErrorResponse(`Invalid purchase order item reference: ${item.purchaseOrderItem}`, 400)
      );
    }

    // Find the corresponding item in the purchase order
    const poItem = purchaseOrder.items.find(
      i => i._id.toString() === item.purchaseOrderItem.toString()
    );

    if (!poItem) {
      return next(
        new ErrorResponse(`Item not found in purchase order`, 404)
      );
    }

    // Calculate remaining quantity
    const remainingQuantity = poItem.quantity - poItem.receivedQuantity;
    
    // Allow over-receiving for all items, just add a note if it happens
    if (item.quantityReceived > remainingQuantity) {
      // Add a note about over-receiving
      item.notes = item.notes 
        ? `${item.notes} | Over-received: ordered ${poItem.quantity}, already received ${poItem.receivedQuantity}, receiving ${item.quantityReceived}`
        : `Over-received: ordered ${poItem.quantity}, already received ${poItem.receivedQuantity}, receiving ${item.quantityReceived}`;
    }

    // Set inventory reference if available
    if (poItem.inventory) {
      item.inventory = poItem.inventory;
    }
  }

  // Create the purchase receiving
  const purchaseReceiving = await PurchaseReceiving.create(req.body);

  // Update the purchase order with received quantities
  for (const item of req.body.items) {
    const poItem = purchaseOrder.items.find(
      i => i._id.toString() === item.purchaseOrderItem.toString()
    );
    
    if (poItem) {
      poItem.receivedQuantity = (poItem.receivedQuantity || 0) + item.quantityReceived;
    }
  }

  // Always set purchase order status to Completed when receiving
  purchaseOrder.status = 'Completed';

  await purchaseOrder.save();

  // Update inventory quantities
  for (const item of req.body.items) {
    if (item.inventory) {
      const inventory = await Inventory.findById(item.inventory);
      if (inventory) {
        inventory.quantity += item.quantityReceived;
        await inventory.save();
      }
    }
  }

  res.status(201).json({
    success: true,
    data: purchaseReceiving
  });
});

// @desc    Update purchase receiving
// @route   PUT /api/v1/purchase-receiving/:id
// @access  Private
exports.updatePurchaseReceiving = asyncHandler(async (req, res, next) => {
  let purchaseReceiving = await PurchaseReceiving.findById(req.params.id);

  if (!purchaseReceiving) {
    return next(
      new ErrorResponse(`Purchase receiving not found with id of ${req.params.id}`, 404)
    );
  }

  // Remove _id field if present to prevent casting errors
  if (req.body._id !== undefined) {
    delete req.body._id;
  }
  
  // Allow updating notes, status, branch, and items
  const allowedUpdates = {
    notes: req.body.notes,
    status: req.body.status
  };

  // If branch is being explicitly set to null or undefined, check if user has a branch
  if (req.body.hasOwnProperty('branch')) {
    if (req.body.branch) {
      allowedUpdates.branch = req.body.branch;
    } else if (req.user.branch) {
      allowedUpdates.branch = req.user.branch;
    } else {
      return next(
        new ErrorResponse('Please add a branch. User does not have a default branch assigned.', 400)
      );
    }
  }

  // Allow updating items if provided
  if (req.body.items && Array.isArray(req.body.items)) {
    // Remove any _id fields from items array to prevent casting errors
    allowedUpdates.items = req.body.items.map(item => {
      // Create a new object without the _id field
      const { _id, ...itemWithoutId } = item;
      return itemWithoutId;
    });
  }

  // Allow updating receivingDate if provided
  if (req.body.receivingDate) {
    allowedUpdates.receivingDate = req.body.receivingDate;
  }

  purchaseReceiving = await PurchaseReceiving.findByIdAndUpdate(
    req.params.id,
    allowedUpdates,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: purchaseReceiving
  });
});

// @desc    Delete purchase receiving
// @route   DELETE /api/v1/purchase-receiving/:id
// @access  Private
exports.deletePurchaseReceiving = asyncHandler(async (req, res, next) => {
  const purchaseReceiving = await PurchaseReceiving.findById(req.params.id);

  if (!purchaseReceiving) {
    return next(
      new ErrorResponse(`Purchase receiving not found with id of ${req.params.id}`, 404)
    );
  }

  // Prevent deletion of completed receiving that has updated inventory
  if (purchaseReceiving.status === 'Completed') {
    return next(
      new ErrorResponse(
        `Cannot delete a completed receiving as inventory has been updated`,
        400
      )
    );
  }

  await purchaseReceiving.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get purchase receivings by purchase order
// @route   GET /api/v1/purchase-orders/:purchaseOrderId/receivings
// @access  Private
exports.getPurchaseReceivingsByPO = asyncHandler(async (req, res, next) => {
  const purchaseOrder = await PurchaseOrder.findById(req.params.purchaseOrderId);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.purchaseOrderId}`, 404)
    );
  }

  const receivings = await PurchaseReceiving.find({
    purchaseOrder: req.params.purchaseOrderId
  });

  res.status(200).json({
    success: true,
    count: receivings.length,
    data: receivings
  });
});
