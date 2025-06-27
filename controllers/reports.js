const { supabase } = require('../config/supabase');
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
    
    // First, let's check what sales exist in the database
    const { data: allSales, error: debugError } = await supabase
      .from('sales')
      .select('id, sale_number, total, customer_id, created_at')
      .limit(10);
    
    console.log('Sales Report - Debug: All sales in database (sample):', allSales);
    console.log('Sales Report - Debug error:', debugError);
    
    // Build Supabase query for sales with customer details
    let query = supabase.from('sales').select(`
      *,
      customer:users!customer_id(id, name, email)
    `);
    
    // Add date range filter
    const startDateISO = new Date(startDate).toISOString();
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    const endDateISO = endDateObj.toISOString();
    
    console.log('Sales Report - Date filter:', { startDateISO, endDateISO });
    
    query = query.gte('created_at', startDateISO).lte('created_at', endDateISO);
    
    // Add branch filter if provided
    if (branch) {
      query = query.eq('branch', branch);
    }
    
    // Execute query
    const { data: sales, error: salesError } = await query.order('created_at', { ascending: false });
    
    if (salesError) {
      console.error('Sales Report - Query error:', salesError);
      throw salesError;
    }
    
    console.log('Sales Report - Filtered sales count:', sales?.length || 0);
    
    // Calculate summary statistics
    const totalSales = sales?.length || 0;
    const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    // Group sales by day for chart data
    const salesByDay = {};
    sales?.forEach(sale => {
      const date = new Date(sale.created_at).toISOString().split('T')[0];
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
      salesCount: sales?.length || 0,
      totalRevenue,
      averageSale,
      dailySalesDataCount: dailySalesData.length
    });
    
    // Return report data
    res.status(200).json({
      success: true,
      data: {
        sales: sales || [],
        totalSales,
        totalRevenue,
        averageSale,
        dailySalesData
      }
    });
  } catch (err) {
    console.error('Sales Report Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
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
    
    // First, let's check what quotations exist with delivery assignments
    const { data: allQuotationsWithDelivery, error: debugError } = await supabase
      .from('quotations')
      .select('id, quotation_number, status, assigned_delivery, created_at, updated_at')
      .not('assigned_delivery', 'is', null)
      .limit(10);
    
    console.log('Delivery Report - Debug: All quotations with delivery (sample):', allQuotationsWithDelivery);
    
    // Build Supabase query for quotations with delivery assignments
    let query = supabase.from('quotations').select(`
      *,
      customer:users!customer_id(id, name, email, phone),
      assigned_delivery_user:users!assigned_delivery(id, name, email, phone)
    `);
    
    // Filter for quotations with assigned delivery
    query = query.not('assigned_delivery', 'is', null);
    
    // Add date range filter - use created_at instead of updated_at for broader results
    const startDateISO = new Date(startDate).toISOString();
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    const endDateISO = endDateObj.toISOString();
    
    console.log('Delivery Report - Date filter:', { startDateISO, endDateISO });
    
    query = query.gte('created_at', startDateISO).lte('created_at', endDateISO);
    
    // Add delivery user filter if provided
    if (deliveryUser && deliveryUser !== 'all') {
      query = query.eq('assigned_delivery', deliveryUser);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Execute query
    const { data: deliveries, error: deliveriesError } = await query.order('updated_at', { ascending: false });
    
    if (deliveriesError) {
      console.error('Delivery Report - Quotations query error:', deliveriesError);
      throw deliveriesError;
    }
    
    console.log('Delivery Report - Deliveries found:', deliveries?.length || 0);
    
    // Get all delivery users for filtering
    const { data: deliveryUsers, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('role', 'delivery');
    
    if (usersError) {
      console.error('Delivery Report - Users query error:', usersError);
      throw usersError;
    }
    
    console.log('Delivery Report - Delivery users found:', deliveryUsers?.length || 0);
    
    // Calculate summary statistics
    const totalDeliveries = deliveries?.length || 0;
    const completedDeliveries = deliveries?.filter(d => d.status === 'completed').length || 0;
    const pendingDeliveries = deliveries?.filter(d => d.status === 'approved' || d.status === 'pending').length || 0;
    const totalDeliveryAccounts = deliveryUsers?.length || 0;
    
    // Group deliveries by delivery user
    const deliveriesByUser = {};
    deliveries?.forEach(delivery => {
      if (!delivery.assigned_delivery_user) return;
      
      const userId = delivery.assigned_delivery_user.id;
      if (!deliveriesByUser[userId]) {
        deliveriesByUser[userId] = {
          user: delivery.assigned_delivery_user,
          totalDeliveries: 0,
          completedDeliveries: 0,
          pendingDeliveries: 0,
          totalRevenue: 0
        };
      }
      
      deliveriesByUser[userId].totalDeliveries += 1;
      if (delivery.status === 'completed') {
        deliveriesByUser[userId].completedDeliveries += 1;
      } else if (delivery.status === 'approved' || delivery.status === 'pending') {
        deliveriesByUser[userId].pendingDeliveries += 1;
      }
      deliveriesByUser[userId].totalRevenue += (delivery.total || 0);
    });
    
    // Convert to array format for frontend
    const deliveryAccounts = Object.values(deliveriesByUser);
    
    // Format deliveries for frontend
    const formattedDeliveries = deliveries?.map(delivery => ({
      id: delivery.id,
      quotationNumber: delivery.quotation_number || delivery.quotationNumber,
      customer: delivery.customer,
      customerName: delivery.customer?.name || 'Unknown Customer',
      assignedDelivery: delivery.assigned_delivery_user,
      deliveryPersonnel: delivery.assigned_delivery_user?.name || 'Not Assigned',
      assignedDate: delivery.updated_at,
      created_at: delivery.created_at,
      status: delivery.status,
      total: delivery.total,
      amount: delivery.total,
      items: delivery.items || [],
      deliveryAddress: delivery.delivery_address || `${delivery.customer?.name || 'Customer'} Address`,
      notes: delivery.notes
    })) || [];
    
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
        deliveryPersonnel: deliveryUsers || [],
        totalDeliveryAccounts,
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries
      }
    });
  } catch (err) {
    console.error('Delivery Report Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
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
      created_at: {
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
      .sort({ created_at: -1 });
    
    // Calculate summary statistics
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, purchase) => sum + (purchase.totalAmount || purchase.total || 0), 0);
    const averagePurchase = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
    
    // Group purchases by day for chart data
    const purchasesByDay = {};
    purchases.forEach(purchase => {
      const date = purchase.created_at.toISOString().split('T')[0];
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
    
    // Get all customers (users with role 'customer')
    const { data: customers, error: customersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });
    
    if (customersError) {
      console.error('Customer Report - Customers query error:', customersError);
      throw customersError;
    }
    
    console.log('Customer Report - Total customers found:', customers?.length || 0);
    console.log('Customer Report - Sample customers:', customers?.slice(0, 2).map(c => ({ id: c.id, name: c.name, role: c.role })) || []);
    
    // Build query with proper date handling
    const startDateISO = new Date(startDate).toISOString();
    const salesEndDateObj = new Date(endDate);
    salesEndDateObj.setHours(23, 59, 59, 999);
    const endDateISO = salesEndDateObj.toISOString();
    
    // Get sales within date range
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        customer:users!customer_id(id, name, email, phone)
      `)
      .gte('created_at', startDateISO)
      .lte('created_at', endDateISO)
      .order('created_at', { ascending: false });
    
    if (salesError) {
      console.error('Customer Report - Sales query error:', salesError);
      throw salesError;
    }
    
    console.log('Customer Report - Sales found in date range:', sales?.length || 0);
    console.log('Customer Report - Sample sales:', sales?.slice(0, 2).map(s => ({ 
      id: s.id, 
      date: s.created_at, 
      total: s.total, 
      customer: s.customer ? s.customer.name : 'No customer' 
    })) || []);
    
    // Calculate summary statistics
    const totalCustomers = customers?.length || 0;
    const customerStartDate = new Date(startDate);
    const customerEndDate = new Date(endDate);
    const newCustomers = customers?.filter(c => {
      const customerDate = new Date(c.created_at);
      return customerDate >= customerStartDate && customerDate <= customerEndDate;
    }).length || 0;
    const totalSales = sales?.length || 0;
    const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    
    // Group sales by customer
    const salesByCustomer = {};
    sales?.forEach(sale => {
      if (!sale.customer || !sale.customer.id) return;
      
      const customerId = sale.customer.id;
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
