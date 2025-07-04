const Quotation = require('../models/Quotation');
const Inventory = require('../models/Inventory');
const webSocketService = require('../utils/websocketService');

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

    // Role-based filtering
    const baseQuery = JSON.parse(queryStr);
    
    if (req.user.role === 'user') {
      // Users can only see quotations they created
      baseQuery.createdBy = req.user.id;
    } else if (req.user.role === 'delivery') {
      // Delivery users can only see quotations assigned to them
      // Use ObjectId to match before population happens
      baseQuery.assignedDelivery = req.user.id;
    }
    // Admin and superadmin can see all quotations

    // Finding resource - use lean() to prevent population issues with filtering
    let query;
    if (req.user.role === 'delivery') {
      // For delivery users, we need to query without population first, then populate
      query = Quotation.find(baseQuery).populate({
        path: 'customer',
        select: 'name email phone'
      }).populate({
        path: 'items.inventory',
        select: 'name itemcode'
      }).populate({
        path: 'assignedDelivery',
        select: 'name email phone'
      }).populate({
        path: 'createdBy',
        select: 'name email'
      });
    } else {
      // For other roles, use normal find (which will use the pre middleware)
      query = Quotation.find(baseQuery);
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
    const total = await Quotation.countDocuments(baseQuery);

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

    // Notify admin users about new quotation via WebSocket
    webSocketService.notifyQuotationCreated({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      total: quotation.total,
      status: quotation.status,
      createdBy: {
        _id: req.user.id,
        name: req.user.name,
        email: req.user.email
      },
      createdAt: quotation.createdAt
    });

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

    // Allow user role, admin, and superadmin to update quotations
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isUser = req.user.role === 'user';
    
    if (!isAdmin && !isUser) {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this quotation`
      });
    }

    quotation = await Quotation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Notify admin users about quotation update via WebSocket
    webSocketService.notifyQuotationUpdated({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      total: quotation.total,
      status: quotation.status,
      updatedBy: req.user.id,
      updatedAt: new Date()
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

    // Make sure user is quotation creator or admin/superadmin
    if (quotation.createdBy.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
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
 * @desc    Approve quotation with delivery assignment
 * @route   POST /api/v1/quotations/:id/approve
 * @access  Private
 */
exports.approveQuotation = async (req, res) => {
  try {
    // Populate the quotation with createdBy user details
    const quotation = await Quotation.findById(req.params.id).populate('createdBy', 'name email');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if quotation is pending
    if (quotation.status !== 'pending' && quotation.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only pending quotations can be approved'
      });
    }

    // Check if user is authorized to approve (only admin and superadmin can approve)
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can approve quotations'
      });
    }

    // Validate delivery assignment if provided
    if (req.body.assignedDelivery) {
      const User = require('../models/User');
      const deliveryUser = await User.findById(req.body.assignedDelivery);
      
      if (!deliveryUser || deliveryUser.role !== 'delivery') {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery user selected'
        });
      }
      
      quotation.assignedDelivery = req.body.assignedDelivery;
    }

    // Update quotation status
    quotation.status = 'approved';
    await quotation.save();

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotation: {
        _id: quotation._id,
        quotationNumber: quotation.quotationNumber,
        customer: quotation.customer,
        status: quotation.status,
        assignedDelivery: quotation.assignedDelivery,
        createdBy: quotation.createdBy // This will now include the populated user data
      },
      previousStatus: 'pending',
      newStatus: quotation.status,
      approvedBy: req.user.id,
      updatedAt: new Date()
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

    // Check if quotation is pending
    if (quotation.status !== 'pending' && quotation.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only pending quotations can be rejected'
      });
    }

    // Check if user is authorized to reject (only admin role can reject)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can reject quotations'
      });
    }

    // Update quotation status
    quotation.status = 'rejected';
    await quotation.save();

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      status: quotation.status,
      rejectedBy: req.user.id,
      updatedAt: new Date()
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
 * @desc    Mark quotation as delivered
 * @route   POST /api/v1/quotations/:id/deliver
 * @access  Private
 */
exports.markAsDelivered = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if quotation is approved or accepted
    if (quotation.status !== 'approved' && quotation.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only approved quotations can be marked as delivered'
      });
    }

    // Check if user is authorized (any delivery user can mark as delivered)
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        message: 'Only delivery personnel can mark quotations as delivered'
      });
    }

    // Update quotation status to completed
    quotation.status = 'completed';
    await quotation.save();

    // Create sale from quotation data
    const Sale = require('../models/Sale');
    
    // Filter out items with zero quantity for the sale
    const validItems = quotation.items.filter(item => item.quantity > 0);
    
    // Recalculate totals based on valid items only
    const validSubtotal = validItems.reduce((sum, item) => sum + item.total, 0);
    const validTotal = validSubtotal + (quotation.taxAmount || 0) - (quotation.discountAmount || 0);
    
    const saleData = {
      saleNumber: `S-${Date.now()}`,
      quotation: quotation._id,
      customer: quotation.customer, // This should be the customer ID from the quotation
      items: validItems,
      subtotal: validSubtotal,
      taxAmount: quotation.taxAmount,
      discountAmount: quotation.discountAmount,
      total: validTotal,
      status: 'pending',
      amountPaid: 0,
      balance: validTotal,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      createdBy: req.user.id // Use the delivery user who marked it as delivered
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

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      status: quotation.status,
      deliveredBy: req.user.id,
      saleCreated: sale._id,
      updatedAt: new Date()
    });

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

/**
 * @desc    Get delivery users
 * @route   GET /api/v1/quotations/delivery-users
 * @access  Private
 */
exports.getDeliveryUsers = async (req, res) => {
  try {
    // Check if user is authorized (only admin and superadmin)
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can access delivery users'
      });
    }

    const User = require('../models/User');
    const deliveryUsers = await User.find({ role: 'delivery', isActive: true }).select('name email phone');

    res.status(200).json({
      success: true,
      data: deliveryUsers
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Cancel quotation (user cancellation or request)
 * @route   POST /api/v1/quotations/:id/cancel
 * @access  Private
 */
exports.cancelQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if user owns the quotation (unless admin)
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const quotationCreatorId = quotation.createdBy?._id || quotation.createdBy?.id || quotation.createdBy;
    const currentUserId = req.user.id || req.user._id;
    
    console.log('Cancel Authorization Debug:', {
      isAdmin,
      quotationCreatorId: quotationCreatorId?.toString(),
      currentUserId: currentUserId?.toString(),
      userRole: req.user.role,
      quotationStatus: quotation.status
    });
    
    if (!isAdmin && quotationCreatorId?.toString() !== currentUserId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this quotation'
      });
    }

    // Check if quotation can be cancelled
    if (['cancelled', 'completed', 'delivered'].includes(quotation.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel quotation with status: ${quotation.status}`
      });
    }

    // Direct cancellation for early stages
    if (['draft', 'pending'].includes(quotation.status) || isAdmin) {
      quotation.status = 'cancelled';
      quotation.cancelledAt = new Date();
      quotation.cancelledBy = req.user.id;
      quotation.cancellationReason = req.body.reason || 'No reason provided';
      await quotation.save();

      // Notify admin and related users
      webSocketService.notifyQuotationStatusChanged({
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        customer: quotation.customer,
        status: quotation.status,
        cancelledBy: req.user.id,
        cancellationReason: quotation.cancellationReason,
        updatedAt: new Date()
      });

      return res.status(200).json({
        success: true,
        message: 'Quotation cancelled successfully',
        data: quotation
      });
    }

    // Request cancellation for later stages (approved/accepted)
    if (['approved', 'accepted'].includes(quotation.status)) {
      quotation.status = 'cancellation_requested';
      quotation.cancellationRequestedAt = new Date();
      quotation.cancellationRequestedBy = req.user.id;
      quotation.cancellationReason = req.body.reason || 'No reason provided';
      await quotation.save();

      // Notify admin for approval
      webSocketService.notifyQuotationStatusChanged({
        quotationId: quotation._id,
        quotationNumber: quotation.quotationNumber,
        customer: quotation.customer,
        status: quotation.status,
        cancellationRequestedBy: req.user.id,
        cancellationReason: quotation.cancellationReason,
        updatedAt: new Date()
      });

      return res.status(200).json({
        success: true,
        message: 'Cancellation request submitted. Waiting for admin approval.',
        data: quotation
      });
    }

    // Cannot cancel
    return res.status(400).json({
      success: false,
      message: `Cannot cancel quotation with status: ${quotation.status}`
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Approve cancellation request (admin only)
 * @route   POST /api/v1/quotations/:id/approve-cancellation
 * @access  Private (Admin only)
 */
exports.approveCancellation = async (req, res) => {
  try {
    // Only admin can approve cancellations
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can approve cancellations'
      });
    }

    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    if (quotation.status !== 'cancellation_requested') {
      return res.status(400).json({
        success: false,
        message: 'No cancellation request found for this quotation'
      });
    }

    // Restore inventory if quotation was originally accepted (inventory was reserved)
    // We need to check the original status before it became 'cancellation_requested'
    // For now, we'll restore inventory for any cancellation request to be safe
    // In a production system, you'd want to track the original status
    await restoreInventoryQuantities(quotation.items);

    quotation.status = 'cancelled';
    quotation.cancelledAt = new Date();
    quotation.cancelledBy = req.user.id;
    await quotation.save();

    // Notify user and delivery personnel
    webSocketService.notifyQuotationStatusChanged({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      status: quotation.status,
      cancelledBy: req.user.id,
      cancellationApprovedBy: req.user.id,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Cancellation approved successfully',
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
 * @desc    Deny cancellation request (admin only)
 * @route   POST /api/v1/quotations/:id/deny-cancellation
 * @access  Private (Admin only)
 */
exports.denyCancellation = async (req, res) => {
  try {
    // Only admin can deny cancellations
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can deny cancellations'
      });
    }

    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    if (quotation.status !== 'cancellation_requested') {
      return res.status(400).json({
        success: false,
        message: 'No cancellation request found for this quotation'
      });
    }

    // Restore original status (should be approved or accepted)
    const originalStatus = quotation.cancellationRequestedBy ? 'approved' : 'pending';
    quotation.status = originalStatus;
    
    // Clear cancellation request fields
    quotation.cancellationRequestedAt = undefined;
    quotation.cancellationRequestedBy = undefined;
    quotation.cancellationReason = undefined;
    
    await quotation.save();

    // Notify user that cancellation was denied
    webSocketService.notifyQuotationStatusChanged({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      status: quotation.status,
      cancellationDeniedBy: req.user.id,
      denialReason: req.body.reason || 'Cancellation request denied',
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Cancellation request denied',
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
 * @desc    Helper function to restore inventory quantities
 */
const restoreInventoryQuantities = async (items) => {
  for (const item of items) {
    const inventoryItem = await Inventory.findById(item.inventory);
    if (inventoryItem) {
      inventoryItem.quantity += item.quantity;
      await inventoryItem.save();
    }
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

    // Check if quotation is approved or accepted
    if (quotation.status !== 'approved' && quotation.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only approved quotations can be converted to a sale'
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
    
    // Filter out items with zero quantity for the sale
    const validItems = quotation.items.filter(item => item.quantity > 0);
    
    // Recalculate totals based on valid items only
    const validSubtotal = validItems.reduce((sum, item) => sum + item.total, 0);
    const validTotal = validSubtotal + (quotation.taxAmount || 0) - (quotation.discountAmount || 0);
    
    const saleData = {
      saleNumber: `S-${Date.now()}`,
      quotation: quotation._id,
      customer: quotation.customer,
      items: validItems,
      subtotal: validSubtotal,
      taxAmount: quotation.taxAmount,
      discountAmount: quotation.discountAmount,
      total: validTotal,
      status: 'pending',
      amountPaid: 0,
      balance: validTotal,
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

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer,
      status: quotation.status,
      convertedBy: req.user.id,
      saleCreated: sale._id,
      updatedAt: new Date()
    });

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
