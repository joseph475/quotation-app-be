const { supabase } = require('../config/supabase');

/**
 * @desc    Get dashboard summary
 * @route   GET /api/v1/dashboard/summary
 * @access  Private
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    // Get counts using Supabase
    const { count: inventoryCount, error: inventoryError } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });
    
    if (inventoryError) throw inventoryError;
    
    // Count quotations
    const { count: quotationCount, error: quotationError } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true });
    
    if (quotationError) throw quotationError;
    
    // Count customers (users with role 'customer')
    const { count: customersCount, error: customersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer')
      .eq('is_active', true);
    
    if (customersError) throw customersError;
    
    // Count sales
    const { count: saleCount, error: saleError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });
    
    if (saleError) throw saleError;

    // Get sales totals (using correct column names)
    const { data: salesData, error: salesDataError } = await supabase
      .from('sales')
      .select('total, payment_status');
    
    if (salesDataError) throw salesDataError;

    const salesTotal = salesData?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    // Calculate paid total based on payment_status
    const paidTotal = salesData?.filter(sale => sale.payment_status === 'paid')
      .reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    const outstandingTotal = salesTotal - paidTotal;

    // Create monthly data placeholder (simplified)
    const monthlyData = Array(12).fill().map((_, i) => ({
      month: i + 1,
      total: 0,
      count: 0
    }));

    res.status(200).json({
      success: true,
      data: {
        counts: {
          inventory: inventoryCount || 0,
          customers: customersCount || 0,
          quotations: quotationCount || 0,
          sales: saleCount || 0
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
    console.error('Dashboard summary error:', err);
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
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: sales?.length || 0,
      data: sales || []
    });
  } catch (err) {
    console.error('Recent sales error:', err);
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
    // Get top selling items based on sale_items data
    const { data: saleItems, error: saleItemsError } = await supabase
      .from('sale_items')
      .select(`
        inventory_id,
        quantity,
        total,
        inventory:inventory_id (
          id,
          name,
          itemcode
        )
      `);

    if (saleItemsError) throw saleItemsError;

    // Aggregate sales data by inventory item
    const salesByItem = {};
    saleItems?.forEach(item => {
      const inventoryId = item.inventory_id;
      if (!salesByItem[inventoryId]) {
        salesByItem[inventoryId] = {
          inventory: item.inventory,
          totalQuantitySold: 0,
          totalRevenue: 0,
          salesCount: 0
        };
      }
      salesByItem[inventoryId].totalQuantitySold += parseFloat(item.quantity || 0);
      salesByItem[inventoryId].totalRevenue += parseFloat(item.total || 0);
      salesByItem[inventoryId].salesCount += 1;
    });

    // Convert to array and sort by total quantity sold
    const topSellingItems = Object.values(salesByItem)
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
      .slice(0, 10)
      .map(item => ({
        _id: item.inventory?.id,
        name: item.inventory?.name,
        itemCode: item.inventory?.itemcode,
        currentStock: 0, // Would need to calculate from inventory_history
        totalQuantitySold: item.totalQuantitySold,
        totalRevenue: item.totalRevenue,
        salesCount: item.salesCount
      }));

    res.status(200).json({
      success: true,
      count: topSellingItems.length,
      data: topSellingItems
    });
  } catch (err) {
    console.error('Top selling items error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get low stock items
 * @route   GET /api/v1/dashboard/low-stock
 * @access  Private
 */
exports.getLowStockItems = async (req, res) => {
  try {
    // For now, return all inventory items since we need to implement proper stock calculation
    // from inventory_history table. This is a placeholder implementation.
    const { data: items, error } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true })
      .limit(10);

    if (error) throw error;

    // Add placeholder stock levels - in a real implementation, 
    // this would calculate current stock from inventory_history
    const itemsWithStock = items?.map(item => ({
      ...item,
      currentStock: 0, // Placeholder - would calculate from inventory_history
      reorderLevel: 10, // Placeholder - could be stored in inventory table
      isLowStock: true // Placeholder - would be calculated based on currentStock vs reorderLevel
    })) || [];

    res.status(200).json({
      success: true,
      count: itemsWithStock.length,
      data: itemsWithStock
    });
  } catch (err) {
    console.error('Low stock items error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
