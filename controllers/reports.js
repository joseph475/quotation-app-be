const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const PurchaseOrder = require('../models/PurchaseOrder');
const Customer = require('../models/Customer');

/**
 * @desc    Get sales report
 * @route   GET /api/v1/reports/sales
 * @access  Private/Admin,User
 */
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, branch } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }
    
    // Build query
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    // Add branch filter if provided
    if (branch) {
      query.branch = branch;
    }
    
    // Get sales within date range
    const sales = await Sale.find(query)
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });
    
    // Calculate summary statistics
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    // Group sales by day for chart data
    const salesByDay = {};
    sales.forEach(sale => {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!salesByDay[date]) {
        salesByDay[date] = {
          count: 0,
          revenue: 0
        };
      }
      salesByDay[date].count += 1;
      salesByDay[date].revenue += sale.total;
    });
    
    // Convert to array format for frontend
    const dailySalesData = Object.keys(salesByDay).map(date => ({
      date,
      count: salesByDay[date].count,
      revenue: salesByDay[date].revenue
    }));
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        sales,
        totalSales,
        totalRevenue,
        averageSale,
        dailySalesData
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get inventory report
 * @route   GET /api/v1/reports/inventory
 * @access  Private/Admin,User
 */
exports.getInventoryReport = async (req, res, next) => {
  try {
    const { branch } = req.query;
    
    // Build query
    const query = {};
    
    // Add branch filter if provided
    if (branch) {
      query.branch = branch;
    }
    
    // Get inventory items
    const products = await Inventory.find(query)
      .sort({ name: 1 });
    
    // Calculate summary statistics
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.quantity < p.reorderLevel && p.quantity > 0).length;
    const outOfStockCount = products.filter(p => p.quantity === 0).length;
    const totalValue = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
    
    // Group products by category
    const productsByCategory = {};
    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      if (!productsByCategory[category]) {
        productsByCategory[category] = {
          count: 0,
          value: 0
        };
      }
      productsByCategory[category].count += 1;
      productsByCategory[category].value += product.price * product.quantity;
    });
    
    // Convert to array format for frontend
    const categoryData = Object.keys(productsByCategory).map(category => ({
      category,
      count: productsByCategory[category].count,
      value: productsByCategory[category].value
    }));
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        products,
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalValue,
        categoryData
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get purchases report
 * @route   GET /api/v1/reports/purchases
 * @access  Private/Admin,User
 */
exports.getPurchasesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, branch } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }
    
    // Build query
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    // Add branch filter if provided
    if (branch) {
      query.branch = branch;
    }
    
    // Get purchase orders within date range
    const purchases = await PurchaseOrder.find(query)
      .populate('supplier', 'name')
      .sort({ createdAt: -1 });
    
    // Calculate summary statistics
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, purchase) => sum + (purchase.totalAmount || purchase.total || 0), 0);
    const averagePurchase = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
    
    // Group purchases by day for chart data
    const purchasesByDay = {};
    purchases.forEach(purchase => {
      const date = purchase.createdAt.toISOString().split('T')[0];
      if (!purchasesByDay[date]) {
        purchasesByDay[date] = {
          count: 0,
          spent: 0
        };
      }
      purchasesByDay[date].count += 1;
      purchasesByDay[date].spent += purchase.totalAmount || purchase.total || 0;
    });
    
    // Convert to array format for frontend
    const dailyPurchaseData = Object.keys(purchasesByDay).map(date => ({
      date,
      count: purchasesByDay[date].count,
      spent: purchasesByDay[date].spent
    }));
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        purchases,
        totalPurchases,
        totalSpent,
        averagePurchase,
        dailyPurchaseData
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get customers report
 * @route   GET /api/v1/reports/customers
 * @access  Private/Admin,User
 */
exports.getCustomersReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }
    
    // Get all customers
    const customers = await Customer.find().sort({ createdAt: -1 });
    
    // Get sales within date range
    const sales = await Sale.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).populate('customer', 'name email');
    
    // Calculate summary statistics
    const totalCustomers = customers.length;
    const newCustomers = customers.filter(c => 
      c.createdAt >= new Date(startDate) && c.createdAt <= new Date(endDate)
    ).length;
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    
    // Group sales by customer
    const salesByCustomer = {};
    sales.forEach(sale => {
      if (!sale.customer || !sale.customer._id) return;
      
      const customerId = sale.customer._id.toString();
      if (!salesByCustomer[customerId]) {
        salesByCustomer[customerId] = {
          customer: sale.customer,
          salesCount: 0,
          totalSpent: 0
        };
      }
      salesByCustomer[customerId].salesCount += 1;
      salesByCustomer[customerId].totalSpent += sale.total;
    });
    
    // Convert to array and sort by total spent
    const customerSalesData = Object.values(salesByCustomer)
      .sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        customers,
        sales,
        totalCustomers,
        newCustomers,
        totalSales,
        totalRevenue,
        customerSalesData
      }
    });
  } catch (err) {
    next(err);
  }
};
