const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Branch = require('../models/Branch');

// @desc    Get all branches
// @route   GET /api/v1/branches
// @access  Private
exports.getBranches = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single branch
// @route   GET /api/v1/branches/:id
// @access  Private
exports.getBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: branch
  });
});

// @desc    Create new branch
// @route   POST /api/v1/branches
// @access  Private
exports.createBranch = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  const branch = await Branch.create(req.body);

  res.status(201).json({
    success: true,
    data: branch
  });
});

// @desc    Update branch
// @route   PUT /api/v1/branches/:id
// @access  Private
exports.updateBranch = asyncHandler(async (req, res, next) => {
  let branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: branch
  });
});

// @desc    Delete branch
// @route   DELETE /api/v1/branches/:id
// @access  Private
exports.deleteBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  await branch.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Search branches
// @route   GET /api/v1/branches/search
// @access  Private
exports.searchBranches = asyncHandler(async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  const branches = await Branch.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { address: { $regex: query, $options: 'i' } },
      { manager: { $regex: query, $options: 'i' } }
    ]
  });

  res.status(200).json({
    success: true,
    count: branches.length,
    data: branches
  });
});
