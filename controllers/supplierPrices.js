const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const SupplierPrice = require('../models/SupplierPrice');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');

// @desc    Get all supplier prices
// @route   GET /api/v1/supplier-prices
// @access  Private
exports.getSupplierPrices = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get supplier prices by supplier
// @route   GET /api/v1/supplier-prices/supplier/:supplierId
// @access  Private
exports.getSupplierPricesBySupplier = asyncHandler(async (req, res, next) => {
  const { supplierId } = req.params;

  // Check if supplier exists
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${supplierId}`, 404)
    );
  }

  // Get supplier prices
  const supplierPrices = await SupplierPrice.find({ supplier: supplierId })
    .populate({
      path: 'inventory',
      select: 'name itemCode costPrice'
    });

  res.status(200).json({
    success: true,
    count: supplierPrices.length,
    data: supplierPrices
  });
});

// @desc    Get supplier prices by inventory item
// @route   GET /api/v1/supplier-prices/item/:itemId
// @access  Private
exports.getSupplierPricesByItem = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;

  // Check if inventory item exists
  const inventoryItem = await Inventory.findById(itemId);
  if (!inventoryItem) {
    return next(
      new ErrorResponse(`Inventory item not found with id of ${itemId}`, 404)
    );
  }

  // Get supplier prices
  const supplierPrices = await SupplierPrice.find({ inventory: itemId })
    .populate({
      path: 'supplier',
      select: 'name contactPerson'
    });

  res.status(200).json({
    success: true,
    count: supplierPrices.length,
    data: supplierPrices
  });
});

// @desc    Get single supplier price
// @route   GET /api/v1/supplier-prices/:id
// @access  Private
exports.getSupplierPrice = asyncHandler(async (req, res, next) => {
  const supplierPrice = await SupplierPrice.findById(req.params.id)
    .populate({
      path: 'supplier',
      select: 'name contactPerson'
    })
    .populate({
      path: 'inventory',
      select: 'name itemCode costPrice'
    });

  if (!supplierPrice) {
    return next(
      new ErrorResponse(`Supplier price not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: supplierPrice
  });
});

// @desc    Create new supplier price
// @route   POST /api/v1/supplier-prices
// @access  Private
exports.createSupplierPrice = asyncHandler(async (req, res, next) => {
  // Check if supplier exists
  const supplier = await Supplier.findById(req.body.supplier);
  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${req.body.supplier}`, 404)
    );
  }

  // Check if inventory item exists
  const inventoryItem = await Inventory.findById(req.body.inventory);
  if (!inventoryItem) {
    return next(
      new ErrorResponse(`Inventory item not found with id of ${req.body.inventory}`, 404)
    );
  }

  // Create supplier price
  const supplierPrice = await SupplierPrice.create(req.body);

  res.status(201).json({
    success: true,
    data: supplierPrice
  });
});

// @desc    Update supplier price
// @route   PUT /api/v1/supplier-prices/:id
// @access  Private
exports.updateSupplierPrice = asyncHandler(async (req, res, next) => {
  let supplierPrice = await SupplierPrice.findById(req.params.id);

  if (!supplierPrice) {
    return next(
      new ErrorResponse(`Supplier price not found with id of ${req.params.id}`, 404)
    );
  }

  // Update supplier price
  supplierPrice = await SupplierPrice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: supplierPrice
  });
});

// @desc    Delete supplier price
// @route   DELETE /api/v1/supplier-prices/:id
// @access  Private
exports.deleteSupplierPrice = asyncHandler(async (req, res, next) => {
  const supplierPrice = await SupplierPrice.findById(req.params.id);

  if (!supplierPrice) {
    return next(
      new ErrorResponse(`Supplier price not found with id of ${req.params.id}`, 404)
    );
  }

  await supplierPrice.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Update or create multiple supplier prices for a specific supplier
// @route   PUT /api/v1/supplier-prices/supplier/:supplierId
// @access  Private
exports.updateSupplierPrices = asyncHandler(async (req, res, next) => {
  const { supplierId } = req.params;
  const { prices } = req.body;

  // Check if supplier exists
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${supplierId}`, 404)
    );
  }

  // Validate prices array
  if (!Array.isArray(prices) || prices.length === 0) {
    return next(
      new ErrorResponse('Please provide an array of prices', 400)
    );
  }

  const results = [];
  const errors = [];

  // Process each price in the array
  for (const priceData of prices) {
    try {
      // Ensure the supplier ID matches the URL parameter
      priceData.supplier = supplierId;

      // Check if inventory item exists
      const inventoryItem = await Inventory.findById(priceData.inventory || priceData.inventoryId);
      if (!inventoryItem) {
        errors.push({
          inventory: priceData.inventory || priceData.inventoryId,
          error: 'Inventory item not found'
        });
        continue;
      }

      // Normalize the inventory ID field
      priceData.inventory = priceData.inventory || priceData.inventoryId;

      // Check if a price already exists for this supplier and inventory item
      let supplierPrice = await SupplierPrice.findOne({
        supplier: supplierId,
        inventory: priceData.inventory
      });

      if (supplierPrice) {
        // Update existing price
        supplierPrice = await SupplierPrice.findByIdAndUpdate(
          supplierPrice._id,
          { price: priceData.price, updatedAt: Date.now() },
          { new: true, runValidators: true }
        );
        results.push(supplierPrice);
      } else {
        // Create new price
        supplierPrice = await SupplierPrice.create({
          supplier: supplierId,
          inventory: priceData.inventory,
          price: priceData.price
        });
        results.push(supplierPrice);
      }
    } catch (error) {
      errors.push({
        inventory: priceData.inventory || priceData.inventoryId,
        error: error.message
      });
    }
  }

  res.status(200).json({
    success: true,
    count: results.length,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});
