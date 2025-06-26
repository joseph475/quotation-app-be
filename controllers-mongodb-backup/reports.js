const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const PurchaseOrder = require('../models/PurchaseOrder');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Quotation = require('../models/Quotation');

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
    
    console.log('Sales Report - Date range:', { startDate, endDate });
    
    // Build query with proper date handling
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    // Set end date to end of day
    endDateObj.setHours(23, 59, 59, 999);
    
    const query = {
      createdAt: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };
    
    console.log('Sales Report - Query:', query);
    
    // Add branch filter if provided
    if (branch) {
      query.branch = branch;
    }
    
    // Get all sales first to check if there are any
    const allSales = await Sale.find({}).limit(5);
    console.log('Sales Report - Total sales in DB:', await Sale.countDocuments());
    console.log('Sales Report - Sample sales:', allSales.map(s => ({ id: s._id, date: s.createdAt, total: s.total })));
    
    // Get sales within date range
    const sales = await Sale.find(query)
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });
    
    console.log('Sales Report - Filtered sales count:', sales.length);
    
    // Calculate summary statistics
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
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
      salesByDay[date].revenue += (sale.total || 0);
    });
    
    // Convert to array format for frontend
    const dailySalesData = Object.keys(salesByDay).map(date => ({
      date,
      count: salesByDay[date].count,
      revenue: salesByDay[date].revenue
    }));
    
    console.log('Sales Report - Response data:', {
      salesCount: sales.length,
      totalRevenue,
      averageSale,
      dailySalesDataCount: dailySalesData.length
    });
    
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
    console.error('Sales Report Error:', err);
    next(err);
  }
};

/**
 * @desc    Get delivery report
 * @route   GET /api/v1/reports/delivery
 * @access  Private/Admin,User,Delivery
 */
exports.getDeliveryReport = async (req, res, next) => {
  try {
    const { startDate, endDate, deliveryUser, status } = req.query;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide start and end dates'
      });
    }
    
    console.log('Delivery Report - Date range:', { startDate, endDate });
    console.log('Delivery Report - Filters:', { deliveryUser, status });
    
    // Build query with proper date handling
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    // Set end date to end of day
    endDateObj.setHours(23, 59, 59, 999);
    
    const query = {
      assignedDelivery: { $exists: true, $ne: null },
      updatedAt: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };
    
    // Add delivery user filter if provided
    if (deliveryUser && deliveryUser !== 'all') {
      query.assignedDelivery = deliveryUser;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    console.log('Delivery Report - Query:', query);
    
    // Get quotations with delivery assignments within date range
    const deliveries = await Quotation.find(query)
      .populate('customer', 'name email phone')
      .populate('assignedDelivery', 'name email phone')
      .sort({ updatedAt: -1 });
    
    console.log('Delivery Report - Deliveries found:', deliveries.length);
    
    // Get all delivery users for filtering
    const deliveryUsers = await User.find({ 
      role: 'delivery',
      isActive: true 
    }).select('name email phone');
    
    console.log('Delivery Report - Delivery users found:', deliveryUsers.length);
    
    // Calculate summary statistics
    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const pendingDeliveries = deliveries.filter(d => d.status === 'approved' || d.status === 'pending').length;
    const totalDeliveryAccounts = deliveryUsers.length;
    
    // Group deliveries by delivery user
    const deliveriesByUser = {};
    deliveries.forEach(delivery => {
      if (!delivery.assignedDelivery) return;
      
      const userId = delivery.assignedDelivery._id.toString();
      if (!deliveriesByUser[userId]) {
        deliveriesByUser[userId] = {
          user: delivery.assignedDelivery,
          totalDeliveries: 0,
          completedDeliveries: 0,
          pendingDeliveries: 0,
          totalRevenue: 0
        };
      }
      
      deliveriesByUser[userId].totalDeliveries += 1;
      if (delivery.status === 'delivered') {
        deliveriesByUser[userId].completedDeliveries += 1;
      } else if (delivery.status === 'approved' || delivery.status === 'pending') {
        deliveriesByUser[userId].pendingDeliveries += 1;
      }
      deliveriesByUser[userId].totalRevenue += (delivery.total || 0);
    });
    
    // Convert to array format for frontend
    const deliveryAccounts = Object.values(deliveriesByUser);
    
    // Format deliveries for frontend
    const formattedDeliveries = deliveries.map(delivery => ({
      _id: delivery._id,
      quotationNumber: delivery.quotationNumber,
      customer: delivery.customer,
      customerName: delivery.customer?.name || 'Unknown Customer',
      assignedDelivery: delivery.assignedDelivery,
      deliveryPersonnel: delivery.assignedDelivery?.name || 'Not Assigned',
      assignedDate: delivery.updatedAt, // Use updatedAt as assignment date
      createdAt: delivery.createdAt,
      status: delivery.status,
      total: delivery.total,
      amount: delivery.total,
      items: delivery.items || [],
      deliveryAddress: delivery.deliveryAddress || `${delivery.customer?.name || 'Customer'} Address`,
      notes: delivery.notes
    }));
    
    console.log('Delivery Report - Response data:', {
      totalDeliveries,
      completedDeliveries,
      pendingDeliveries,
      totalDeliveryAccounts,
      deliveryAccountsCount: deliveryAccounts.length
    });
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        deliveries: formattedDeliveries,
        deliveryAccounts,
        deliveryPersonnel: deliveryUsers,
        totalDeliveryAccounts,
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries
      }
    });
  } catch (err) {
    console.error('Delivery Report Error:', err);
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
    
    console.log('Customer Report - Date range:', { startDate, endDate });
    
    // Get all customers (users with role 'user')
    const customers = await User.find({ 
      role: 'user',
      isActive: true 
    }).sort({ createdAt: -1 });
    
    console.log('Customer Report - Total customers found:', customers.length);
    console.log('Customer Report - Sample customers:', customers.slice(0, 2).map(c => ({ id: c._id, name: c.name, role: c.role })));
    
    // Build query with proper date handling
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    // Set end date to end of day
    endDateObj.setHours(23, 59, 59, 999);
    
    // Get sales within date range
    const sales = await Sale.find({
      createdAt: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    }).populate('customer', 'name email phone');
    
    console.log('Customer Report - Sales found in date range:', sales.length);
    console.log('Customer Report - Sample sales:', sales.slice(0, 2).map(s => ({ 
      id: s._id, 
      date: s.createdAt, 
      total: s.total, 
      customer: s.customer ? s.customer.name : 'No customer' 
    })));
    
    // Calculate summary statistics
    const totalCustomers = customers.length;
    const newCustomers = customers.filter(c => 
      c.createdAt >= startDateObj && c.createdAt <= endDateObj
    ).length;
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    
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
      salesByCustomer[customerId].totalSpent += (sale.total || 0);
    });
    
    // Convert to array and sort by total spent
    const customerSalesData = Object.values(salesByCustomer)
      .sort((a, b) => b.totalSpent - a.totalSpent);
    
    console.log('Customer Report - Response data:', {
      totalCustomers,
      newCustomers,
      totalSales,
      totalRevenue,
      customerSalesDataCount: customerSalesData.length
    });
    
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
    console.error('Customer Report Error:', err);
    next(err);
  }
};
