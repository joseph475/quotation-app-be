const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const Quotation = require('../models/Quotation');
const Customer = require('../models/Customer');
const User = require('../models/User');

/**
 * @desc    Get dashboard summary
 * @route   GET /api/v1/dashboard/summary
 * @access  Private
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    // Get counts
    const inventoryCount = await Inventory.countDocuments();
    
    // Count only pending quotations
    const pendingQuotationCount = await Quotation.countDocuments({ status: 'pending' });
    
    // Count active customers (users with role 'user' who have made sales or quotations in the last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const activeCustomerIds = await Sale.distinct('customer', {
      createdAt: { $gte: ninetyDaysAgo }
    });
    
    const activeQuotationCustomerIds = await Quotation.distinct('customer', {
      createdAt: { $gte: ninetyDaysAgo }
    });
    
    // Combine and get unique customer IDs, then verify they are users with role 'user'
    const allActiveCustomerIds = [...new Set([...activeCustomerIds, ...activeQuotationCustomerIds])];
    
    // Count only users with role 'user' from the active customer IDs
    const activeCustomerCount = await User.countDocuments({
      _id: { $in: allActiveCustomerIds },
      role: 'user',
      isActive: true
    });
    
    const saleCount = await Sale.countDocuments();

    // Get sales total
    const salesAggregate = await Sale.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalPaid: { $sum: '$amountPaid' },
          totalOutstanding: { $sum: '$balance' }
        }
      }
    ]);

    const salesTotal = salesAggregate.length > 0 ? salesAggregate[0].totalSales : 0;
    const paidTotal = salesAggregate.length > 0 ? salesAggregate[0].totalPaid : 0;
    const outstandingTotal = salesAggregate.length > 0 ? salesAggregate[0].totalOutstanding : 0;

    // Get monthly sales data for the current year
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // January 1st of current year
    const endDate = new Date(currentYear, 11, 31); // December 31st of current year

    const monthlySales = await Sale.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.month': 1 }
      }
    ]);

    // Format monthly sales data
    const monthlyData = Array(12).fill().map((_, i) => {
      const monthNumber = i + 1;
      const monthData = monthlySales.find(m => m._id.month === monthNumber);
      
      return {
        month: monthNumber,
        total: monthData ? monthData.total : 0,
        count: monthData ? monthData.count : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        counts: {
          inventory: inventoryCount,
          customers: activeCustomerCount,
          quotations: pendingQuotationCount,
          sales: saleCount
        },
        sales: {
          total: salesTotal,
          paid: paidTotal,
          outstanding: outstandingTotal
        },
        monthlySales: monthlyData
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
 * @desc    Get recent sales
 * @route   GET /api/v1/dashboard/recent-sales
 * @access  Private
 */
exports.getRecentSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .sort('-createdAt')
      .limit(10)
      .populate({
        path: 'customer',
        select: 'name'
      });

    res.status(200).json({
      success: true,
      count: sales.length,
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
 * @desc    Get top selling items
 * @route   GET /api/v1/dashboard/top-selling
 * @access  Private
 */
exports.getTopSellingItems = async (req, res) => {
  try {
    // Get top selling items from sales data
    const topSellingItems = await Sale.aggregate([
      // Unwind the items array to work with individual items
      { $unwind: '$items' },
      
      // Group by inventory item and sum quantities
      {
        $group: {
          _id: '$items.inventory',
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          salesCount: { $sum: 1 }
        }
      },
      
      // Sort by total quantity sold (descending)
      { $sort: { totalQuantitySold: -1 } },
      
      // Limit to top 10
      { $limit: 10 },
      
      // Lookup inventory details
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: '_id',
          as: 'inventoryDetails'
        }
      },
      
      // Unwind inventory details
      { $unwind: '$inventoryDetails' },
      
      // Project the final structure
      {
        $project: {
          _id: '$inventoryDetails._id',
          name: '$inventoryDetails.name',
          itemCode: '$inventoryDetails.itemCode',
          currentStock: '$inventoryDetails.quantity',
          totalQuantitySold: 1,
          totalRevenue: 1,
          salesCount: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: topSellingItems.length,
      data: topSellingItems
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get low stock items (kept for backward compatibility)
 * @route   GET /api/v1/dashboard/low-stock
 * @access  Private
 */
exports.getLowStockItems = async (req, res) => {
  try {
    const items = await Inventory.find({
      $expr: {
        $lte: ['$quantity', '$reorderLevel']
      }
    }).sort('quantity');

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
