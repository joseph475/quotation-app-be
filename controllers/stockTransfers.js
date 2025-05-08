const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const StockTransfer = require('../models/StockTransfer');
const Inventory = require('../models/Inventory');

// @desc    Process stock transfer between branches
// @route   POST /api/v1/stock-transfers/process
// @access  Private
exports.processStockTransfer = asyncHandler(async (req, res, next) => {
  try {
    console.log('Processing stock transfer between branches');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user);
    
    // 1. Extract data from request
    const { 
      itemId, 
      fromBranchId, 
      toBranchId, 
      quantity: quantityStr,
      notes,
      fromBranch,
      toBranch 
    } = req.body;
    
    console.log('Extracted data:');
    console.log('- itemId:', itemId);
    console.log('- fromBranchId:', fromBranchId);
    console.log('- toBranchId:', toBranchId);
    console.log('- quantityStr:', quantityStr);
    console.log('- fromBranch:', fromBranch);
    console.log('- toBranch:', toBranch);
    
    const quantity = parseInt(quantityStr || '0');
    console.log('Parsed quantity:', quantity);
    
    if (!itemId || !fromBranchId || !toBranchId || !quantity) {
      console.error('Missing required fields');
      console.error('- itemId present:', !!itemId);
      console.error('- fromBranchId present:', !!fromBranchId);
      console.error('- toBranchId present:', !!toBranchId);
      console.error('- quantity present:', !!quantity);
      
      return res.status(400).json({
        success: false,
        message: 'Please provide itemId, fromBranchId, toBranchId, and quantity'
      });
    }
    
    // 2. Find source inventory item
    console.log('Finding source inventory item with ID:', itemId);
    const sourceItem = await Inventory.findById(itemId);
    if (!sourceItem) {
      console.error('Source inventory item not found');
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id ${itemId}`
      });
    }
    
    console.log('Source item found:', sourceItem);
    
    // 3. Check if item belongs to source branch
    console.log('Comparing branch IDs:');
    console.log('- Source item branch:', sourceItem.branch.toString());
    console.log('- From branch ID:', fromBranchId.toString());
    
    if (sourceItem.branch.toString() !== fromBranchId.toString()) {
      console.error('Branch mismatch');
      return res.status(400).json({
        success: false,
        message: 'Item does not belong to the source branch'
      });
    }
    
    // 4. Check if there's enough quantity
    console.log('Checking quantity:');
    console.log('- Source quantity:', sourceItem.quantity);
    console.log('- Transfer quantity:', quantity);
    
    if (sourceItem.quantity < quantity) {
      console.error('Not enough stock');
      return res.status(400).json({
        success: false,
        message: `Not enough stock in source branch. Available: ${sourceItem.quantity}, Requested: ${quantity}`
      });
    }
    
    // 5. Generate transfer number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    console.log('Finding latest transfer for numbering');
    const latestTransfer = await StockTransfer.findOne().sort('-createdAt');
    let nextNumber = 1;
    
    if (latestTransfer && latestTransfer.transferNumber) {
      console.log('Latest transfer found:', latestTransfer.transferNumber);
      const parts = latestTransfer.transferNumber.split('-');
      if (parts.length === 4) {
        nextNumber = parseInt(parts[3]) + 1;
      }
    }
    
    const transferNumber = `ST-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
    console.log('Generated transfer number:', transferNumber);
    
    // 6. Get branch names
    const fromBranchName = fromBranch || 'Unknown';
    const toBranchName = toBranch || 'Unknown';
    console.log('Branch names:');
    console.log('- From branch:', fromBranchName);
    console.log('- To branch:', toBranchName);
    
    // 7. Create stock transfer
    console.log('Creating stock transfer record');
    const stockTransferData = {
      transferNumber,
      itemId,
      fromBranch: fromBranchName,
      fromBranchId,
      toBranch: toBranchName,
      toBranchId,
      quantity,
      transferDate: date,
      notes,
      status: 'Completed',
      createdBy: req.user.id
    };
    
    console.log('Stock transfer data:', stockTransferData);
    
    try {
      const stockTransfer = new StockTransfer(stockTransferData);
      await stockTransfer.save();
      console.log('Stock transfer saved successfully:', stockTransfer._id);
      
      // 8. Update source inventory
      console.log('Updating source inventory');
      console.log('- Before:', sourceItem.quantity);
      sourceItem.quantity = sourceItem.quantity - quantity;
      console.log('- After:', sourceItem.quantity);
      await sourceItem.save();
      console.log('Source inventory updated successfully');
      
      // 9. Find or create destination inventory
      console.log('Finding destination inventory');
      console.log('- Item code:', sourceItem.itemCode);
      console.log('- To branch ID:', toBranchId);
      
      let destItem = await Inventory.findOne({
        itemCode: sourceItem.itemCode,
        branch: toBranchId
      });
      
      if (destItem) {
        // Update existing item
        console.log('Destination item found:', destItem._id);
        console.log('- Before:', destItem.quantity);
        destItem.quantity = destItem.quantity + quantity;
        console.log('- After:', destItem.quantity);
        await destItem.save();
        console.log('Destination inventory updated successfully');
      } else {
        // Create new item
        console.log('Destination item not found, creating new item');
        const newItemData = {
          itemCode: sourceItem.itemCode,
          name: sourceItem.name,
          description: sourceItem.description,
          category: sourceItem.category,
          unit: sourceItem.unit,
          costPrice: sourceItem.costPrice,
          sellingPrice: sourceItem.sellingPrice,
          quantity: quantity,
          reorderLevel: sourceItem.reorderLevel,
          supplier: sourceItem.supplier,
          branch: toBranchId
        };
        
        console.log('New item data:', newItemData);
        
        destItem = new Inventory(newItemData);
        await destItem.save();
        console.log('New destination item created:', destItem._id);
      }
      
      // 10. Return success response
      console.log('Stock transfer completed successfully');
      return res.status(201).json({
        success: true,
        data: stockTransfer
      });
    } catch (saveError) {
      console.error('Error saving data:');
      console.error('- Message:', saveError.message);
      console.error('- Stack:', saveError.stack);
      
      if (saveError.name === 'ValidationError') {
        console.error('Validation error details:', saveError.errors);
        
        // Extract validation error messages
        const validationErrors = {};
        for (const field in saveError.errors) {
          validationErrors[field] = saveError.errors[field].message;
        }
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors
        });
      }
      
      throw saveError; // Re-throw for the outer catch block to handle
    }
  } catch (error) {
    console.error('Error in processStockTransfer:');
    console.error('- Message:', error.message);
    console.error('- Stack:', error.stack);
    console.error('- Name:', error.name);
    
    if (error.code === 11000) {
      console.error('Duplicate key error:', error.keyValue);
      return res.status(400).json({
        success: false,
        message: 'Duplicate key error',
        error: error.keyValue
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message,
      error: error.message
    });
  }
});

// @desc    Get all stock transfers
// @route   GET /api/v1/stock-transfers
// @access  Private
exports.getStockTransfers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single stock transfer
// @route   GET /api/v1/stock-transfers/:id
// @access  Private
exports.getStockTransfer = asyncHandler(async (req, res, next) => {
  const stockTransfer = await StockTransfer.findById(req.params.id);

  if (!stockTransfer) {
    return next(
      new ErrorResponse(`Stock transfer not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: stockTransfer
  });
});

// @desc    Create new stock transfer
// @route   POST /api/v1/stock-transfers
// @access  Private
exports.createStockTransfer = asyncHandler(async (req, res, next) => {
  console.log('Creating stock transfer with direct inventory update');
  console.log('Request body:', req.body);
  console.log('User:', req.user);
  
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;
    console.log('Added createdBy to request body:', req.body.createdBy);
    
    // Set status to Completed by default if not provided
    if (!req.body.status) {
      req.body.status = 'Completed';
      console.log('Set default status to Completed');
    }

    // 1. Find the source inventory item
    console.log('Finding source inventory item with ID:', req.body.itemId);
    const sourceItem = await Inventory.findById(req.body.itemId);
    if (!sourceItem) {
      console.error('Source inventory item not found');
      return next(
        new ErrorResponse(`Inventory item not found with id of ${req.body.itemId}`, 404)
      );
    }
    
    console.log('Source item found:', sourceItem);
    
    // 2. Check if the item belongs to the source branch
    console.log('Comparing branch IDs:');
    console.log('Source item branch:', sourceItem.branch.toString());
    console.log('From branch ID:', req.body.fromBranchId.toString());
    
    if (sourceItem.branch.toString() !== req.body.fromBranchId.toString()) {
      console.error('Branch mismatch');
      return next(
        new ErrorResponse(`Item does not belong to the source branch`, 400)
      );
    }
    
    // 3. Check if there's enough quantity in the source branch
    const transferQuantity = parseInt(req.body.quantity);
    console.log('Transfer quantity:', transferQuantity);
    console.log('Source item quantity:', sourceItem.quantity);
    
    if (sourceItem.quantity < transferQuantity) {
      console.error('Not enough stock');
      return next(
        new ErrorResponse(`Not enough stock in source branch. Available: ${sourceItem.quantity}, Requested: ${transferQuantity}`, 400)
      );
    }
    
    // 4. Generate transfer number if not provided
    if (!req.body.transferNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // Get the latest transfer to increment the number
      const latestTransfer = await StockTransfer.findOne().sort('-createdAt');
      let nextNumber = 1;
      
      if (latestTransfer && latestTransfer.transferNumber) {
        // Extract the number part from the latest transfer number (assuming format ST-YYYY-MM-XXXX)
        const parts = latestTransfer.transferNumber.split('-');
        if (parts.length === 4) {
          nextNumber = parseInt(parts[3]) + 1;
        }
      }
      
      req.body.transferNumber = `ST-${year}-${month}-${String(nextNumber).padStart(4, '0')}`;
      console.log('Generated transfer number:', req.body.transferNumber);
    }
    
    // 5. Create the stock transfer
    console.log('Creating stock transfer with data:', req.body);
    const stockTransfer = await StockTransfer.create(req.body);
    console.log('Stock transfer created:', stockTransfer);
    
    // Only update inventory if the transfer status is 'Completed'
    if (req.body.status === 'Completed') {
      try {
        // 6. Decrease quantity from source branch
        console.log('Decreasing quantity in source branch');
        console.log('Before:', sourceItem.quantity);
        sourceItem.quantity = sourceItem.quantity - transferQuantity;
        console.log('After:', sourceItem.quantity);
        await sourceItem.save();
        console.log('Source item saved successfully');
        
        // 7. Increase quantity in destination branch or create new item
        console.log('Looking for destination item with itemCode:', sourceItem.itemCode, 'and branch:', req.body.toBranchId);
        let destItem = await Inventory.findOne({
          itemCode: sourceItem.itemCode,
          branch: req.body.toBranchId
        });
        
        if (destItem) {
          // If item exists in destination branch, increase quantity
          console.log('Destination item found:', destItem);
          console.log('Before:', destItem.quantity);
          destItem.quantity = destItem.quantity + transferQuantity;
          console.log('After:', destItem.quantity);
          await destItem.save();
          console.log('Destination item saved successfully');
        } else {
          // If item doesn't exist in destination branch, create a new inventory item
          console.log('Creating new inventory item in destination branch');
          const newItemData = {
            itemCode: sourceItem.itemCode,
            name: sourceItem.name,
            description: sourceItem.description,
            category: sourceItem.category,
            unit: sourceItem.unit,
            costPrice: sourceItem.costPrice,
            sellingPrice: sourceItem.sellingPrice,
            quantity: transferQuantity,
            reorderLevel: sourceItem.reorderLevel,
            supplier: sourceItem.supplier,
            branch: req.body.toBranchId
          };
          console.log('New item data:', newItemData);
          
          destItem = await Inventory.create(newItemData);
          console.log('New destination item created:', destItem);
        }
        
        console.log('Inventory update completed successfully');
      } catch (updateErr) {
        console.error('Error updating inventory:', updateErr);
        console.error('Error stack:', updateErr.stack);
        console.error('Error details:', updateErr.message);
        
        // Even if inventory update fails, we still return the created stock transfer
        console.warn('Stock transfer created but inventory update failed');
      }
    }
    
    console.log('Sending success response');
    res.status(201).json({
      success: true,
      data: stockTransfer
    });
  } catch (err) {
    console.error('Error in createStockTransfer:', err);
    console.error('Error stack:', err.stack);
    console.error('Error message:', err.message);
    console.error('Request body:', req.body);
    return next(
      new ErrorResponse(`Error creating stock transfer: ${err.message}`, 500)
    );
  }
});

// @desc    Update inventory quantities for a stock transfer
// @param   {Object} stockTransfer - The stock transfer object
// @returns {Promise<void>}
const updateInventoryForTransfer = async (stockTransfer) => {
  console.log('Updating inventory for stock transfer:', stockTransfer._id);
  
  try {
    // 1. Decrease quantity from source branch
    // Find the inventory item by ID and branch
    console.log('Finding source item by ID and branch');
    console.log('Item ID:', stockTransfer.itemId);
    console.log('From branch ID:', stockTransfer.fromBranchId);
    
    // Try different ways to find the source item
    let sourceItem = null;
    
    // Try 1: Find by ID and branch
    sourceItem = await Inventory.findOne({
      _id: stockTransfer.itemId,
      branch: stockTransfer.fromBranchId
    });
    
    // Try 2: Find by ID and branch toString
    if (!sourceItem) {
      console.log('Try 2: Find by ID and branch toString');
      sourceItem = await Inventory.findOne({
        _id: stockTransfer.itemId,
        branch: stockTransfer.fromBranchId.toString()
      });
    }
    
    // Try 3: Find just by ID
    if (!sourceItem) {
      console.log('Try 3: Find just by ID');
      sourceItem = await Inventory.findById(stockTransfer.itemId);
    }
    
    if (!sourceItem) {
      console.error('Source item not found');
      throw new Error('Source item not found');
    }
    
    console.log('Source item found:', sourceItem._id);
    console.log('Source item branch:', sourceItem.branch);
    console.log('Source item quantity before:', sourceItem.quantity);
    
    // Update source item quantity
    sourceItem.quantity -= parseInt(stockTransfer.quantity);
    console.log('Source item quantity after:', sourceItem.quantity);
    await sourceItem.save();
    console.log('Source item saved successfully');
    
    // 2. Increase quantity in destination branch
    // First check if the item exists in the destination branch
    console.log('Looking for item in destination branch');
    console.log('Item code:', sourceItem.itemCode);
    console.log('To branch ID:', stockTransfer.toBranchId);
    
    let destItem = await Inventory.findOne({
      itemCode: sourceItem.itemCode,
      branch: stockTransfer.toBranchId
    });
    
    if (!destItem) {
      console.log('Try with toString()');
      destItem = await Inventory.findOne({
        itemCode: sourceItem.itemCode,
        branch: stockTransfer.toBranchId.toString()
      });
    }
    
    if (destItem) {
      // If item exists in destination branch, increase quantity
      console.log('Destination item found:', destItem._id);
      console.log('Destination item quantity before:', destItem.quantity);
      destItem.quantity += parseInt(stockTransfer.quantity);
      console.log('Destination item quantity after:', destItem.quantity);
      await destItem.save();
      console.log('Destination item saved successfully');
    } else {
      // If item doesn't exist in destination branch, create a new inventory item
      console.log('Creating new inventory item in destination branch');
      destItem = await Inventory.create({
        itemCode: sourceItem.itemCode,
        name: sourceItem.name,
        description: sourceItem.description,
        category: sourceItem.category,
        unit: sourceItem.unit,
        costPrice: sourceItem.costPrice,
        sellingPrice: sourceItem.sellingPrice,
        quantity: stockTransfer.quantity,
        reorderLevel: sourceItem.reorderLevel,
        supplier: sourceItem.supplier,
        branch: stockTransfer.toBranchId
      });
      console.log('New destination item created:', destItem._id);
    }
    
    console.log('Inventory update completed successfully');
  } catch (err) {
    console.error('Error in updateInventoryForTransfer:', err);
    throw err;
  }
};

// @desc    Update stock transfer
// @route   PUT /api/v1/stock-transfers/:id
// @access  Private
exports.updateStockTransfer = asyncHandler(async (req, res, next) => {
  let stockTransfer = await StockTransfer.findById(req.params.id);

  if (!stockTransfer) {
    return next(
      new ErrorResponse(`Stock transfer not found with id of ${req.params.id}`, 404)
    );
  }

  // Only allow updating notes and status
  const allowedUpdates = {
    notes: req.body.notes,
    status: req.body.status
  };

  // Check if status is being changed to 'Completed'
  const statusChangedToCompleted = 
    stockTransfer.status !== 'Completed' && 
    req.body.status === 'Completed';

  stockTransfer = await StockTransfer.findByIdAndUpdate(req.params.id, allowedUpdates, {
    new: true,
    runValidators: true
  });

  // Update inventory quantities if status is changed to 'Completed'
  if (statusChangedToCompleted) {
    try {
      console.log('Status changed to Completed, updating inventory directly');
      
      // Find the source item
      const sourceItem = await Inventory.findById(stockTransfer.itemId);
      if (!sourceItem) {
        throw new Error(`Source item not found with id ${stockTransfer.itemId}`);
      }
      
      // 1. Decrease quantity from source branch
      console.log('Source item before update:', sourceItem);
      sourceItem.quantity -= parseInt(stockTransfer.quantity);
      console.log('Source item after update:', sourceItem);
      await sourceItem.save();
      console.log('Source item saved successfully');
      
      // 2. Increase quantity in destination branch or create new item
      let destItem = await Inventory.findOne({
        itemCode: sourceItem.itemCode,
        branch: stockTransfer.toBranchId
      });
      
      if (destItem) {
        // If item exists in destination branch, increase quantity
        console.log('Destination item found:', destItem);
        destItem.quantity += parseInt(stockTransfer.quantity);
        console.log('Destination item after update:', destItem);
        await destItem.save();
        console.log('Destination item saved successfully');
      } else {
        // If item doesn't exist in destination branch, create a new inventory item
        console.log('Creating new inventory item in destination branch');
        destItem = await Inventory.create({
          itemCode: sourceItem.itemCode,
          name: sourceItem.name,
          description: sourceItem.description,
          category: sourceItem.category,
          unit: sourceItem.unit,
          costPrice: sourceItem.costPrice,
          sellingPrice: sourceItem.sellingPrice,
          quantity: stockTransfer.quantity,
          reorderLevel: sourceItem.reorderLevel,
          supplier: sourceItem.supplier,
          branch: stockTransfer.toBranchId
        });
        console.log('New destination item created:', destItem);
      }
      
      console.log('Inventory update completed successfully');
    } catch (err) {
      console.error('Error updating inventory:', err);
      return next(
        new ErrorResponse(`Error updating inventory: ${err.message}`, 500)
      );
    }
  }

  res.status(200).json({
    success: true,
    data: stockTransfer
  });
});

// @desc    Update inventory for a stock transfer
// @route   POST /api/v1/stock-transfers/:id/update-inventory
// @access  Private
exports.updateInventory = asyncHandler(async (req, res, next) => {
  const stockTransfer = await StockTransfer.findById(req.params.id);

  if (!stockTransfer) {
    return next(
      new ErrorResponse(`Stock transfer not found with id of ${req.params.id}`, 404)
    );
  }

  try {
    await updateInventoryForTransfer(stockTransfer);
    
    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully'
    });
  } catch (err) {
    return next(
      new ErrorResponse(`Error updating inventory: ${err.message}`, 500)
    );
  }
});

// @desc    Delete stock transfer
// @route   DELETE /api/v1/stock-transfers/:id
// @access  Private
exports.deleteStockTransfer = asyncHandler(async (req, res, next) => {
  const stockTransfer = await StockTransfer.findById(req.params.id);

  if (!stockTransfer) {
    return next(
      new ErrorResponse(`Stock transfer not found with id of ${req.params.id}`, 404)
    );
  }

  // Prevent deletion of completed transfers
  if (stockTransfer.status === 'Completed') {
    return next(
      new ErrorResponse(
        `Cannot delete a completed stock transfer as inventory has been updated`,
        400
      )
    );
  }

  await stockTransfer.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});
