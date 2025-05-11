const Inventory = require('../models/Inventory');

/**
 * @desc    Search inventory items
 * @route   GET /api/v1/inventory/search
 * @access  Private
 */
exports.searchInventory = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query'
      });
    }
    
    // Create search filter
    const searchFilter = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { itemCode: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { model: { $regex: query, $options: 'i' } },
        { color: { $regex: query, $options: 'i' } }
      ]
    };
    
    // If user is not admin, filter by branch
    if (req.user.role !== 'admin' && req.user.branch) {
      searchFilter.branch = req.user.branch;
    }
    
    const inventory = await Inventory.find(searchFilter).populate('branch', 'name');
    
    // Ensure discount and unit are properly set for all items
    const inventoryData = inventory.map(item => {
      const itemObj = item.toObject();
      itemObj.discount = itemObj.discount !== undefined ? itemObj.discount : 0;
      itemObj.unit = itemObj.unit || 'pcs';
      return itemObj;
    });
    
    res.status(200).json({
      success: true,
      count: inventoryData.length,
      data: inventoryData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get all inventory items
 * @route   GET /api/v1/inventory
 * @access  Private
 */
exports.getInventory = async (req, res) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    let query = Inventory.find(JSON.parse(queryStr)).populate('branch', 'name');

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Inventory.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const inventory = await query;

    // Ensure discount and unit are properly set for all items
    const inventoryData = inventory.map(item => {
      const itemObj = item.toObject();
      itemObj.discount = itemObj.discount !== undefined ? itemObj.discount : 0;
      itemObj.unit = itemObj.unit || 'pcs';
      return itemObj;
    });

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
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
      count: inventoryData.length,
      pagination,
      data: inventoryData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get single inventory item
 * @route   GET /api/v1/inventory/:id
 * @access  Private
 */
exports.getInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id).populate('branch', 'name');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id of ${req.params.id}`
      });
    }

    // Ensure discount and unit are properly set in the response
    const itemData = item.toObject();
    itemData.discount = itemData.discount !== undefined ? itemData.discount : 0;
    itemData.unit = itemData.unit || 'pcs';

    // Check if the request includes a query parameter to include supplier prices
    if (req.query.includeSupplierPrices === 'true') {
      // Import the SupplierPrice model
      const SupplierPrice = require('../models/SupplierPrice');
      
      // Get supplier prices for this inventory item
      const supplierPrices = await SupplierPrice.find({ inventory: req.params.id })
        .populate({
          path: 'supplier',
          select: 'name contactPerson'
        });
      
      // Add supplier prices to the response
      return res.status(200).json({
        success: true,
        data: itemData,
        supplierPrices: supplierPrices
      });
    }

    res.status(200).json({
      success: true,
      data: itemData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Create new inventory item
 * @route   POST /api/v1/inventory
 * @access  Private
 */
exports.createInventoryItem = async (req, res) => {
  try {
    // Ensure discount and unit are properly set
    const itemData = {
      ...req.body,
      discount: req.body.discount || 0,
      unit: req.body.unit || 'pcs'
    };
    
    const item = await Inventory.create(itemData);

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Update inventory item
 * @route   PUT /api/v1/inventory/:id
 * @access  Private
 */
exports.updateInventoryItem = async (req, res) => {
  try {
    // Ensure discount and unit are properly set
    const itemData = {
      ...req.body,
      discount: req.body.discount !== undefined ? req.body.discount : 0,
      unit: req.body.unit || 'pcs'
    };
    
    const item = await Inventory.findByIdAndUpdate(req.params.id, itemData, {
      new: true,
      runValidators: true
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get inventory items by branch
 * @route   GET /api/v1/inventory/branch/:branchId
 * @access  Private
 */
exports.getInventoryByBranch = async (req, res) => {
  try {
    const branchId = req.params.branchId;
    
    // Copy req.query
    const reqQuery = { ...req.query, branch: branchId };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    let query = Inventory.find(JSON.parse(queryStr)).populate('branch', 'name');

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Inventory.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const inventory = await query;

    // Ensure discount and unit are properly set for all items
    const inventoryData = inventory.map(item => {
      const itemObj = item.toObject();
      itemObj.discount = itemObj.discount !== undefined ? itemObj.discount : 0;
      itemObj.unit = itemObj.unit || 'pcs';
      return itemObj;
    });

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
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
      count: inventoryData.length,
      pagination,
      data: inventoryData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Delete inventory item
 * @route   DELETE /api/v1/inventory/:id
 * @access  Private
 */
exports.deleteInventoryItem = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id of ${req.params.id}`
      });
    }

    await item.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
