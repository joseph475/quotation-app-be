const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const CostHistory = require('../models/CostHistory');

// @desc    Get all cost history
// @route   GET /api/v1/cost-history
// @access  Private
exports.getCostHistory = asyncHandler(async (req, res, next) => {
  let query = {};

  // Filter by item ID
  if (req.query.itemId) {
    query.itemId = req.query.itemId;
  }

  // Filter by date range
  if (req.query.startDate && req.query.endDate) {
    query.date = {
      $gte: req.query.startDate,
      $lte: req.query.endDate
    };
  }

  // Filter by month
  if (req.query.month) {
    query.month = req.query.month;
  }

  // Filter by user
  if (req.query.userId) {
    query.userId = req.query.userId;
  }

  // Filter by branch
  if (req.query.branchId) {
    query.branchId = req.query.branchId;
  }

  // Filter by change type
  if (req.query.changeType) {
    query.changeType = req.query.changeType;
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  const startIndex = (page - 1) * limit;

  // Execute query
  const total = await CostHistory.countDocuments(query);
  const costHistory = await CostHistory.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(startIndex)
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  // Pagination result
  const pagination = {};

  if (startIndex + limit < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: costHistory.length,
    total,
    pagination,
    data: costHistory
  });
});

// @desc    Get cost history for specific item
// @route   GET /api/v1/cost-history/item/:itemId
// @access  Private
exports.getCostHistoryByItem = asyncHandler(async (req, res, next) => {
  const costHistory = await CostHistory.find({ itemId: req.params.itemId })
    .sort({ createdAt: -1 })
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: costHistory.length,
    data: costHistory
  });
});

// @desc    Get cost history by month
// @route   GET /api/v1/cost-history/month/:month
// @access  Private
exports.getCostHistoryByMonth = asyncHandler(async (req, res, next) => {
  const costHistory = await CostHistory.find({ month: req.params.month })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: costHistory.length,
    data: costHistory
  });
});

// @desc    Create cost history record
// @route   POST /api/v1/cost-history
// @access  Private
exports.createCostHistory = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.userId = req.user.id;

  const costHistory = await CostHistory.create(req.body);

  res.status(201).json({
    success: true,
    data: costHistory
  });
});

// @desc    Get monthly cost report
// @route   GET /api/v1/cost-history/reports/monthly/:month
// @access  Private
exports.getMonthlyCostReport = asyncHandler(async (req, res, next) => {
  const month = req.params.month;

  // Get all cost history for the month
  const monthlyHistory = await CostHistory.find({ month })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  // Group by item
  const itemSummary = {};

  monthlyHistory.forEach(record => {
    if (!itemSummary[record.itemId]) {
      itemSummary[record.itemId] = {
        itemId: record.itemId,
        itemName: record.itemName,
        itemCode: record.itemCode,
        costChanges: [],
        totalQuantityAdded: 0,
        costChangeCount: 0,
        averageCostChange: 0,
        latestCost: record.newCost
      };
    }

    const item = itemSummary[record.itemId];
    item.costChanges.push({
      date: record.date,
      previousCost: record.previousCost,
      newCost: record.newCost,
      costChange: record.costChange,
      quantityAdded: record.quantityAdded,
      reason: record.reason
    });

    item.totalQuantityAdded += record.quantityAdded;
    item.costChangeCount += 1;
    item.latestCost = record.newCost; // Keep updating to get the latest
  });

  // Calculate averages
  Object.values(itemSummary).forEach(item => {
    if (item.costChangeCount > 0) {
      const totalCostChange = item.costChanges.reduce((sum, change) => sum + change.costChange, 0);
      item.averageCostChange = totalCostChange / item.costChangeCount;
    }
  });

  const report = {
    month,
    totalItems: Object.keys(itemSummary).length,
    totalCostChanges: monthlyHistory.length,
    totalQuantityAdded: monthlyHistory.reduce((sum, record) => sum + record.quantityAdded, 0),
    items: Object.values(itemSummary),
    rawHistory: monthlyHistory
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    Delete cost history record
// @route   DELETE /api/v1/cost-history/:id
// @access  Private/Admin
exports.deleteCostHistory = asyncHandler(async (req, res, next) => {
  const costHistory = await CostHistory.findById(req.params.id);

  if (!costHistory) {
    return next(new ErrorResponse(`Cost history not found with id of ${req.params.id}`, 404));
  }

  await costHistory.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});
