const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');

/**
 * @desc    Get all sales
 * @route   GET /api/v1/sales
 * @access  Private
 */
exports.getSales = async (req, res) => {
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
    let query = Sale.find(JSON.parse(queryStr));
    
    // Filter by branch if specified
    if (req.query.branch) {
      query = query.find({ branch: req.query.branch });
    }

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
    const total = await Sale.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const sales = await query;

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
      count: sales.length,
      pagination,
      data: sales
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get single sale
 * @route   GET /api/v1/sales/:id
 * @access  Private
 */
exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Create new sale
 * @route   POST /api/v1/sales
 * @access  Private
 */
exports.createSale = async (req, res) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;
    
    // If branch is not provided, use the user's branch
    if (!req.body.branch && req.user.branch) {
      req.body.branch = req.user.branch;
    }
    
    // Create sale
    const sale = await Sale.create(req.body);

    // Update inventory quantities
    for (const item of sale.items) {
      const inventoryItem = await Inventory.findById(item.inventory);
      if (inventoryItem) {
        inventoryItem.quantity -= item.quantity;
        await inventoryItem.save();
      }
    }

    res.status(201).json({
      success: true,
      data: sale
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Update sale
 * @route   PUT /api/v1/sales/:id
 * @access  Private
 */
exports.updateSale = async (req, res) => {
  try {
    let sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale not found with id of ${req.params.id}`
      });
    }

    // Make sure user is sale creator or admin
    if (sale.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this sale`
      });
    }

    // If updating items, handle inventory changes
    if (req.body.items) {
      // Restore original quantities
      for (const item of sale.items) {
        const inventoryItem = await Inventory.findById(item.inventory);
        if (inventoryItem) {
          inventoryItem.quantity += item.quantity;
          await inventoryItem.save();
        }
      }

      // Deduct new quantities
      for (const item of req.body.items) {
        const inventoryItem = await Inventory.findById(item.inventory);
        if (inventoryItem) {
          inventoryItem.quantity -= item.quantity;
          await inventoryItem.save();
        }
      }
    }

    sale = await Sale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Delete sale
 * @route   DELETE /api/v1/sales/:id
 * @access  Private
 */
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale not found with id of ${req.params.id}`
      });
    }

    // Make sure user is sale creator or admin
    if (sale.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this sale`
      });
    }

    // Restore inventory quantities
    for (const item of sale.items) {
      const inventoryItem = await Inventory.findById(item.inventory);
      if (inventoryItem) {
        inventoryItem.quantity += item.quantity;
        await inventoryItem.save();
      }
    }

    await sale.deleteOne();

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

/**
 * @desc    Update payment status
 * @route   PUT /api/v1/sales/:id/payment
 * @access  Private
 */
exports.updatePayment = async (req, res) => {
  try {
    const { amountPaid, paymentMethod, paymentDetails } = req.body;

    if (!amountPaid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount paid'
      });
    }

    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `Sale not found with id of ${req.params.id}`
      });
    }

    // Update payment details
    sale.amountPaid += parseFloat(amountPaid);
    sale.balance = sale.total - sale.amountPaid;
    
    if (paymentMethod) {
      sale.paymentMethod = paymentMethod;
    }
    
    if (paymentDetails) {
      sale.paymentDetails = paymentDetails;
    }

    // Update status based on payment
    if (sale.balance <= 0) {
      sale.status = 'paid';
    } else if (sale.amountPaid > 0) {
      sale.status = 'partially_paid';
    }

    await sale.save();

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
