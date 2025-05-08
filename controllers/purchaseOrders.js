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

  // Handle branch field
  if (!req.body.branch) {
    // If branch is not provided, use the user's branch
    if (req.user.branch) {
      req.body.branch = req.user.branch;
    } else {
      return next(
        new ErrorResponse('Please add a branch. User does not have a default branch assigned.', 400)
      );
    }
  } else if (typeof req.body.branch === 'string' && !req.body.branch.match(/^[0-9a-fA-F]{24}$/)) {
    // If branch is provided as a name (string) instead of an ID
    const Branch = require('../models/Branch');
    const branchByName = await Branch.findOne({ name: req.body.branch });
    if (branchByName) {
      req.body.branch = branchByName._id;
    } else {
      return next(
        new ErrorResponse(`Branch not found with name: ${req.body.branch}`, 404)
      );
    }
  }

  // Check if supplier is provided as a name (string) instead of an ID
  if (req.body.supplier && typeof req.body.supplier === 'string' && !req.body.supplier.match(/^[0-9a-fA-F]{24}$/)) {
    // Try to find supplier by name
    const supplierByName = await Supplier.findOne({ name: req.body.supplier });
    if (supplierByName) {
      req.body.supplier = supplierByName._id;
    } else {
      return next(
        new ErrorResponse(`Supplier not found with name: ${req.body.supplier}`, 404)
      );
    }
  } else {
    // Check if supplier exists by ID
    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier) {
      return next(
        new ErrorResponse(`Supplier not found with id of ${req.body.supplier}`, 404)
      );
    }
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

  // Process inventory items and calculate totals
  let subtotal = 0;
  if (req.body.items && req.body.items.length > 0) {
    // Process each item
    for (let i = 0; i < req.body.items.length; i++) {
      const item = req.body.items[i];
      
      // Remove any _id field from items to prevent casting errors
      if (item._id) {
        delete req.body.items[i]._id;
      }
      
      // Handle inventory reference - could be ID, name, or itemCode
      if (item.inventory) {
        if (typeof item.inventory === 'string' && !item.inventory.match(/^[0-9a-fA-F]{24}$/)) {
          // Try to find inventory by name or itemCode
          const Inventory = require('../models/Inventory');
          let inventoryItem;
          
          // First try by itemCode (more specific)
          inventoryItem = await Inventory.findOne({ 
            itemCode: item.inventory,
            branch: req.body.branch // Scope to the branch in the PO
          });
          
          // If not found by itemCode, try by name
          if (!inventoryItem) {
            inventoryItem = await Inventory.findOne({ 
              name: item.inventory,
              branch: req.body.branch // Scope to the branch in the PO
            });
          }
          
          if (inventoryItem) {
            req.body.items[i].inventory = inventoryItem._id;
            
            // If name is not provided, use the inventory item's name
            if (!item.name) {
              req.body.items[i].name = inventoryItem.name;
            }
            
            // If unitPrice is not provided, use the inventory item's cost price
            if (!item.unitPrice) {
              req.body.items[i].unitPrice = inventoryItem.costPrice;
            }
          } else {
            return next(
              new ErrorResponse(`Inventory item not found with identifier: ${item.inventory}`, 404)
            );
          }
        }
      }
      
      // Handle unitPrice - be very lenient with validation
      // Convert empty strings to 0
      if (req.body.items[i].unitPrice === '') {
        req.body.items[i].unitPrice = 0;
      }
      
      // Try to parse the unitPrice as a number
      const parsedUnitPrice = parseFloat(req.body.items[i].unitPrice);
      
      // If it's a valid number (including 0), use it
      if (!isNaN(parsedUnitPrice)) {
        req.body.items[i].unitPrice = parsedUnitPrice;
      } 
      // If not a valid number, try to get it from inventory
      else if (req.body.items[i].inventory) {
        let inventoryId = req.body.items[i].inventory;
        
        // Handle case where inventory is an object with _id
        if (typeof inventoryId === 'object' && inventoryId._id) {
          inventoryId = inventoryId._id;
        }
        
        try {
          const inventoryItem = await Inventory.findById(inventoryId);
          if (inventoryItem && inventoryItem.costPrice) {
            req.body.items[i].unitPrice = inventoryItem.costPrice;
          } else {
            // Default to 0 if we can't find a valid price
            req.body.items[i].unitPrice = 0;
            console.log(`Warning: Using default price 0 for item ${i + 1}`);
          }
        } catch (err) {
          console.log(`Error finding inventory item: ${err.message}`);
          // Default to 0 if we can't find the inventory item
          req.body.items[i].unitPrice = 0;
        }
      } 
      // If all else fails, default to 0
      else {
        req.body.items[i].unitPrice = 0;
        console.log(`Warning: Using default price 0 for item ${i + 1}`);
      }
      
      // Ensure quantity is a number (must be positive)
      if (req.body.items[i].quantity === undefined || req.body.items[i].quantity === null || 
          isNaN(parseFloat(req.body.items[i].quantity)) || parseFloat(req.body.items[i].quantity) <= 0) {
        return next(
          new ErrorResponse(`Please add a valid quantity (greater than 0) for item ${i + 1}`, 400)
        );
      }
      
      // Convert to numbers to ensure proper calculation
      req.body.items[i].unitPrice = parseFloat(req.body.items[i].unitPrice);
      req.body.items[i].quantity = parseFloat(req.body.items[i].quantity);
      
      // Calculate item total
      req.body.items[i].total = req.body.items[i].quantity * req.body.items[i].unitPrice;
      subtotal += req.body.items[i].total;
    }
  }

  // Ensure taxAmount and discountAmount are numbers
  if (req.body.taxAmount) {
    req.body.taxAmount = parseFloat(req.body.taxAmount) || 0;
  } else {
    req.body.taxAmount = 0;
  }
  
  if (req.body.discountAmount) {
    req.body.discountAmount = parseFloat(req.body.discountAmount) || 0;
  } else {
    req.body.discountAmount = 0;
  }
  
  req.body.subtotal = subtotal;
  req.body.totalAmount = subtotal + req.body.taxAmount - req.body.discountAmount;

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
  // Remove _id field if present to prevent casting errors
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

  let purchaseOrder = await PurchaseOrder.findById(req.params.id);

  if (!purchaseOrder) {
    return next(
      new ErrorResponse(`Purchase order not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if supplier is being updated
  if (req.body.supplier) {
    // Check if supplier is provided as a name (string) instead of an ID
    if (typeof req.body.supplier === 'string' && !req.body.supplier.match(/^[0-9a-fA-F]{24}$/)) {
      // Try to find supplier by name
      const supplierByName = await Supplier.findOne({ name: req.body.supplier });
      if (supplierByName) {
        req.body.supplier = supplierByName._id;
      } else {
        return next(
          new ErrorResponse(`Supplier not found with name: ${req.body.supplier}`, 404)
        );
      }
    } else {
      // Check if supplier exists by ID
      const supplier = await Supplier.findById(req.body.supplier);
      if (!supplier) {
        return next(
          new ErrorResponse(`Supplier not found with id of ${req.body.supplier}`, 404)
        );
      }
    }
  }

  // Handle branch field
  if (req.body.hasOwnProperty('branch')) {
    if (!req.body.branch) {
      // If branch is being explicitly set to null or undefined, check if user has a branch
      if (req.user.branch) {
        req.body.branch = req.user.branch;
      } else {
        return next(
          new ErrorResponse('Please add a branch. User does not have a default branch assigned.', 400)
        );
      }
    } else if (typeof req.body.branch === 'string' && !req.body.branch.match(/^[0-9a-fA-F]{24}$/)) {
      // If branch is provided as a name (string) instead of an ID
      const Branch = require('../models/Branch');
      const branchByName = await Branch.findOne({ name: req.body.branch });
      if (branchByName) {
        req.body.branch = branchByName._id;
      } else {
        return next(
          new ErrorResponse(`Branch not found with name: ${req.body.branch}`, 404)
        );
      }
    }
  }

  // Process inventory items and recalculate totals if items are being updated
  if (req.body.items && req.body.items.length > 0) {
    let subtotal = 0;
    
    // Process each item
    for (let i = 0; i < req.body.items.length; i++) {
      const item = req.body.items[i];
      
      // Remove any _id field from items to prevent casting errors
      if (item._id) {
        delete req.body.items[i]._id;
      }
      
      // Handle inventory reference - could be ID, name, or itemCode
      if (item.inventory) {
        if (typeof item.inventory === 'string' && !item.inventory.match(/^[0-9a-fA-F]{24}$/)) {
          // Try to find inventory by name or itemCode
          const Inventory = require('../models/Inventory');
          let inventoryItem;
          
          // Use the branch from the request body if available, otherwise use the one from the existing purchase order
          const branchId = req.body.branch || purchaseOrder.branch;
          
          // First try by itemCode (more specific)
          inventoryItem = await Inventory.findOne({ 
            itemCode: item.inventory,
            branch: branchId
          });
          
          // If not found by itemCode, try by name
          if (!inventoryItem) {
            inventoryItem = await Inventory.findOne({ 
              name: item.inventory,
              branch: branchId
            });
          }
          
          if (inventoryItem) {
            req.body.items[i].inventory = inventoryItem._id;
            
            // If name is not provided, use the inventory item's name
            if (!item.name) {
              req.body.items[i].name = inventoryItem.name;
            }
            
            // If unitPrice is not provided, use the inventory item's cost price
            if (!item.unitPrice) {
              req.body.items[i].unitPrice = inventoryItem.costPrice;
            }
          } else {
            return next(
              new ErrorResponse(`Inventory item not found with identifier: ${item.inventory}`, 404)
            );
          }
        }
      }
      
      // Handle unitPrice - be very lenient with validation
      // Convert empty strings to 0
      if (req.body.items[i].unitPrice === '') {
        req.body.items[i].unitPrice = 0;
      }
      
      // Try to parse the unitPrice as a number
      const parsedUnitPrice = parseFloat(req.body.items[i].unitPrice);
      
      // If it's a valid number (including 0), use it
      if (!isNaN(parsedUnitPrice)) {
        req.body.items[i].unitPrice = parsedUnitPrice;
      } 
      // If not a valid number, try to get it from inventory
      else if (req.body.items[i].inventory) {
        let inventoryId = req.body.items[i].inventory;
        
        // Handle case where inventory is an object with _id
        if (typeof inventoryId === 'object' && inventoryId._id) {
          inventoryId = inventoryId._id;
        }
        
        try {
          const inventoryItem = await Inventory.findById(inventoryId);
          if (inventoryItem && inventoryItem.costPrice) {
            req.body.items[i].unitPrice = inventoryItem.costPrice;
          } else {
            // Default to 0 if we can't find a valid price
            req.body.items[i].unitPrice = 0;
            console.log(`Warning: Using default price 0 for item ${i + 1}`);
          }
        } catch (err) {
          console.log(`Error finding inventory item: ${err.message}`);
          // Default to 0 if we can't find the inventory item
          req.body.items[i].unitPrice = 0;
        }
      } 
      // If all else fails, default to 0
      else {
        req.body.items[i].unitPrice = 0;
        console.log(`Warning: Using default price 0 for item ${i + 1}`);
      }
      
      // Ensure quantity is a number (must be positive)
      if (req.body.items[i].quantity === undefined || req.body.items[i].quantity === null || 
          isNaN(parseFloat(req.body.items[i].quantity)) || parseFloat(req.body.items[i].quantity) <= 0) {
        return next(
          new ErrorResponse(`Please add a valid quantity (greater than 0) for item ${i + 1}`, 400)
        );
      }
      
      // Convert to numbers to ensure proper calculation
      req.body.items[i].unitPrice = parseFloat(req.body.items[i].unitPrice);
      req.body.items[i].quantity = parseFloat(req.body.items[i].quantity);
      
      // Calculate item total
      req.body.items[i].total = req.body.items[i].quantity * req.body.items[i].unitPrice;
      subtotal += req.body.items[i].total;
    }
    
    // Ensure taxAmount and discountAmount are numbers
    if (req.body.hasOwnProperty('taxAmount')) {
      req.body.taxAmount = parseFloat(req.body.taxAmount) || 0;
    } else if (purchaseOrder.taxAmount) {
      req.body.taxAmount = purchaseOrder.taxAmount;
    } else {
      req.body.taxAmount = 0;
    }
    
    if (req.body.hasOwnProperty('discountAmount')) {
      req.body.discountAmount = parseFloat(req.body.discountAmount) || 0;
    } else if (purchaseOrder.discountAmount) {
      req.body.discountAmount = purchaseOrder.discountAmount;
    } else {
      req.body.discountAmount = 0;
    }
    
    req.body.subtotal = subtotal;
    req.body.totalAmount = subtotal + req.body.taxAmount - req.body.discountAmount;
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
