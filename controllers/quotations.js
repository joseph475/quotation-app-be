const Quotation = require('../models/Quotation');
const Inventory = require('../models/Inventory');

/**
 * @desc    Get all quotations
 * @route   GET /api/v1/quotations
 * @access  Private
 */
exports.getQuotations = async (req, res) => {
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
    let query = Quotation.find(JSON.parse(queryStr));

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
    const total = await Quotation.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const quotations = await query;

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
      count: quotations.length,
      pagination,
      data: quotations
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get single quotation
 * @route   GET /api/v1/quotations/:id
 * @access  Private
 */
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Create new quotation
 * @route   POST /api/v1/quotations
 * @access  Private
 */
exports.createQuotation = async (req, res) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;

    // Create quotation
    const quotation = await Quotation.create(req.body);

    res.status(201).json({
      success: true,
      data: quotation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Update quotation
 * @route   PUT /api/v1/quotations/:id
 * @access  Private
 */
exports.updateQuotation = async (req, res) => {
  try {
    let quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Make sure user is quotation creator or admin
    if (quotation.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this quotation`
      });
    }

    quotation = await Quotation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Delete quotation
 * @route   DELETE /api/v1/quotations/:id
 * @access  Private
 */
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Make sure user is quotation creator or admin
    if (quotation.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this quotation`
      });
    }

    await quotation.deleteOne();

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
 * @desc    Convert quotation to sale
 * @route   POST /api/v1/quotations/:id/convert
 * @access  Private
 */
/**
 * @desc    Reject quotation
 * @route   POST /api/v1/quotations/:id/reject
 * @access  Private
 */
exports.rejectQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if quotation is active
    if (quotation.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active quotations can be rejected'
      });
    }

    // Check if user is authorized to reject (only user role can reject)
    if (req.user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only users can reject quotations'
      });
    }

    // Update quotation status
    quotation.status = 'rejected';
    await quotation.save();

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Convert quotation to sale
 * @route   POST /api/v1/quotations/:id/convert
 * @access  Private
 */
exports.convertToSale = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if quotation is active
    if (quotation.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active quotations can be converted to a sale'
      });
    }

    // Check if user is authorized to convert (only user role can convert)
    if (req.user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only users can convert quotations to sales'
      });
    }

    // Update quotation status
    quotation.status = 'completed';
    await quotation.save();

    // Create sale from quotation data
    const Sale = require('../models/Sale');
    
    const saleData = {
      saleNumber: `S-${Date.now()}`,
      quotation: quotation._id,
      customer: quotation.customer,
      items: quotation.items,
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      discountAmount: quotation.discountAmount,
      total: quotation.total,
      status: 'pending',
      amountPaid: 0,
      balance: quotation.total,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      createdBy: req.user.id
    };

    const sale = await Sale.create(saleData);

    // Update inventory quantities
    for (const item of quotation.items) {
      const inventoryItem = await Inventory.findById(item.inventory);
      if (inventoryItem) {
        inventoryItem.quantity -= item.quantity;
        await inventoryItem.save();
      }
    }

    res.status(200).json({
      success: true,
      data: {
        quotation,
        sale
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
