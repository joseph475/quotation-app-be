const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Supplier = require('../models/Supplier');

// @desc    Get all suppliers
// @route   GET /api/v1/suppliers
// @access  Private
exports.getSuppliers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single supplier
// @route   GET /api/v1/suppliers/:id
// @access  Private
exports.getSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: supplier
  });
});

// @desc    Create new supplier
// @route   POST /api/v1/suppliers
// @access  Private
exports.createSupplier = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  const supplier = await Supplier.create(req.body);

  res.status(201).json({
    success: true,
    data: supplier
  });
});

// @desc    Update supplier
// @route   PUT /api/v1/suppliers/:id
// @access  Private
exports.updateSupplier = asyncHandler(async (req, res, next) => {
  let supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${req.params.id}`, 404)
    );
  }

  supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: supplier
  });
});

// @desc    Delete supplier
// @route   DELETE /api/v1/suppliers/:id
// @access  Private
exports.deleteSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return next(
      new ErrorResponse(`Supplier not found with id of ${req.params.id}`, 404)
    );
  }

  await supplier.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Search suppliers
// @route   GET /api/v1/suppliers/search
// @access  Private
exports.searchSuppliers = asyncHandler(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  const suppliers = await Supplier.find({
    $text: { $search: query }
  }).sort({ score: { $meta: 'textScore' } });

  res.status(200).json({
    success: true,
    count: suppliers.length,
    data: suppliers
  });
});
