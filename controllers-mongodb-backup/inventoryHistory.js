const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const InventoryHistory = require('../models/InventoryHistory');

// @desc    Get all inventory history
// @route   GET /api/v1/inventory-history
// @access  Private
exports.getInventoryHistory = asyncHandler(async (req, res, next) => {
  let query = {};

  // Filter by item ID
  if (req.query.itemId) {
    query.itemId = req.query.itemId;
  }

  // Filter by operation type
  if (req.query.operation) {
    query.operation = req.query.operation;
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

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  const startIndex = (page - 1) * limit;

  // Execute query
  const total = await InventoryHistory.countDocuments(query);
  const inventoryHistory = await InventoryHistory.find(query)
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
    count: inventoryHistory.length,
    total,
    pagination,
    data: inventoryHistory
  });
});

// @desc    Get inventory history for specific item
// @route   GET /api/v1/inventory-history/item/:itemId
// @access  Private
exports.getInventoryHistoryByItem = asyncHandler(async (req, res, next) => {
  const inventoryHistory = await InventoryHistory.find({ itemId: req.params.itemId })
    .sort({ createdAt: -1 })
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: inventoryHistory.length,
    data: inventoryHistory
  });
});

// @desc    Get inventory history by date range
// @route   GET /api/v1/inventory-history/date-range
// @access  Private
exports.getInventoryHistoryByDateRange = asyncHandler(async (req, res, next) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return next(new ErrorResponse('Please provide start and end dates', 400));
  }

  const inventoryHistory = await InventoryHistory.find({
    date: {
      $gte: start,
      $lte: end
    }
  })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: inventoryHistory.length,
    data: inventoryHistory
  });
});

// @desc    Get inventory history by month
// @route   GET /api/v1/inventory-history/month/:month
// @access  Private
exports.getInventoryHistoryByMonth = asyncHandler(async (req, res, next) => {
  const inventoryHistory = await InventoryHistory.find({ month: req.params.month })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: inventoryHistory.length,
    data: inventoryHistory
  });
});

// @desc    Get inventory history by operation type
// @route   GET /api/v1/inventory-history/operation/:operation
// @access  Private
exports.getInventoryHistoryByOperation = asyncHandler(async (req, res, next) => {
  const inventoryHistory = await InventoryHistory.find({ operation: req.params.operation })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  res.status(200).json({
    success: true,
    count: inventoryHistory.length,
    data: inventoryHistory
  });
});

// @desc    Create inventory history record
// @route   POST /api/v1/inventory-history
// @access  Private
exports.createInventoryHistory = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.userId = req.user.id;

  const inventoryHistory = await InventoryHistory.create(req.body);

  res.status(201).json({
    success: true,
    data: inventoryHistory
  });
});

// @desc    Get monthly inventory report
// @route   GET /api/v1/inventory-history/reports/monthly/:month
// @access  Private
exports.getMonthlyInventoryReport = asyncHandler(async (req, res, next) => {
  const month = req.params.month;

  // Get all history for the month
  const monthlyHistory = await InventoryHistory.find({ month })
    .sort({ createdAt: -1 })
    .populate('itemId', 'name itemCode')
    .populate('userId', 'name email')
    .populate('branchId', 'name');

  // Group by operation type
  const operationSummary = {
    add_stock: monthlyHistory.filter(r => r.operation === 'add_stock'),
    update_item: monthlyHistory.filter(r => r.operation === 'update_item'),
    create_item: monthlyHistory.filter(r => r.operation === 'create_item'),
    delete_item: monthlyHistory.filter(r => r.operation === 'delete_item')
  };

  // Group by item
  const itemSummary = {};
  monthlyHistory.forEach(record => {
    if (!itemSummary[record.itemId]) {
      itemSummary[record.itemId] = {
        itemId: record.itemId,
        itemName: record.itemName,
        itemCode: record.itemCode,
        operations: [],
        operationCount: 0,
        lastActivity: record.createdAt
      };
    }

    const item = itemSummary[record.itemId];
    item.operations.push({
      operation: record.operation,
      timestamp: record.createdAt,
      summary: record.changes.summary,
      userName: record.userName,
      reason: record.reason
    });
    item.operationCount += 1;

    // Keep track of most recent activity
    if (new Date(record.createdAt) > new Date(item.lastActivity)) {
      item.lastActivity = record.createdAt;
    }
  });

  // Calculate totals
  const totalStockAdded = operationSummary.add_stock.reduce((sum, record) => {
    const quantityChange = record.changes.details.find(d => d.field === 'quantity');
    return sum + (quantityChange ? quantityChange.change : 0);
  }, 0);

  const report = {
    month,
    totalOperations: monthlyHistory.length,
    operationBreakdown: {
      stockAdditions: operationSummary.add_stock.length,
      itemUpdates: operationSummary.update_item.length,
      itemCreations: operationSummary.create_item.length,
      itemDeletions: operationSummary.delete_item.length
    },
    totalStockAdded,
    totalItemsAffected: Object.keys(itemSummary).length,
    itemDetails: Object.values(itemSummary),
    rawHistory: monthlyHistory
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    Delete inventory history record
// @route   DELETE /api/v1/inventory-history/:id
// @access  Private/Admin
exports.deleteInventoryHistory = asyncHandler(async (req, res, next) => {
  const inventoryHistory = await InventoryHistory.findById(req.params.id);

  if (!inventoryHistory) {
    return next(new ErrorResponse(`Inventory history not found with id of ${req.params.id}`, 404));
  }

  await inventoryHistory.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});
