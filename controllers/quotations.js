const { supabase } = require('../config/supabase');
const webSocketService = require('../utils/websocketService');

/**
 * @desc    Get all quotations
 * @route   GET /api/v1/quotations
 * @access  Private
 */
exports.getQuotations = async (req, res) => {
  try {
    // Build Supabase query with customer details, items with inventory details, and delivery user details
    let query = supabase.from('quotations').select(`
      *,
      customer:users!customer_id(id, name, email),
      items:quotation_items(
        *,
        inventory:inventory(id, name, price, barcode, itemcode)
      ),
      assigned_delivery_user:users!assigned_delivery(id, name, email, phone)
    `);

    // Role-based filtering
    if (req.user.role === 'customer') {
      // Users can only see quotations they created
      query = query.eq('created_by', req.user.id);
    } else if (req.user.role === 'delivery') {
      // Delivery users can only see quotations assigned to them
      query = query.eq('assigned_delivery', req.user.id);
    }
    // Admin and superadmin can see all quotations

    // Apply filters from query parameters
    Object.keys(req.query).forEach(key => {
      if (!['select', 'sort', 'page', 'limit'].includes(key)) {
        query = query.eq(key, req.query[key]);
      }
    });

    // Sort
    if (req.query.sort) {
      const sortField = req.query.sort.replace('-', '');
      const ascending = !req.query.sort.startsWith('-');
      query = query.order(sortField, { ascending });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Get total count for pagination
    const { count: total, error: countError } = await supabase
      .from('quotations')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Apply pagination
    query = query.range(startIndex, startIndex + limit - 1);

    // Execute query
    const { data: quotations, error } = await query;

    if (error) throw error;

    // Transform quotations data to match frontend expectations
    if (quotations && Array.isArray(quotations)) {
      for (let quotation of quotations) {
        if (quotation.items && Array.isArray(quotation.items)) {
          quotation.items = quotation.items.map((item, index) => ({
            // Ensure unique ID for each item
            id: item.id || Date.now() + index,
            
            // Inventory references
            inventory: item.inventory_id,
            inventory_id: item.inventory_id,
            
            // Item details - use inventory name if available, otherwise use a fallback
            description: item.inventory?.name || `Item ${index + 1}`,
            name: item.inventory?.name || `Item ${index + 1}`,
            
            // Numeric values with proper conversion
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.price) || 0,
            price: Number(item.price) || 0,
            total: Number(item.total) || 0,
            
            // Notes
            notes: item.notes || '',
            
            // Editing properties for the form
            isEditing: false,
            editingQuantity: Number(item.quantity) || 0,
            editingNotes: item.notes || '',
            
            // Additional inventory details if available
            barcode: item.inventory?.barcode || '',
            itemcode: item.inventory?.itemcode || ''
          }));
        } else {
          quotation.items = [];
        }
      }
    }

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
      count: quotations?.length || 0,
      pagination,
      data: quotations || []
    });
  } catch (err) {
    console.error('Get quotations error:', err);
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
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select(`
        *,
        customer:users!customer_id(id, name, email),
        items:quotation_items(
          *,
          inventory:inventory(id, name, price, barcode, itemcode)
        ),
        created_by_user:users!created_by(id, name, email),
        assigned_delivery_user:users!assigned_delivery(id, name, email, phone)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Transform the items to match frontend expectations
    if (quotation.items && Array.isArray(quotation.items)) {
      // Fetch inventory details for each item if not included in join
      for (let i = 0; i < quotation.items.length; i++) {
        const item = quotation.items[i];
        if (!item.inventory && item.inventory_id) {
          try {
            const { data: inventoryData, error: inventoryError } = await supabase
              .from('inventory')
              .select('id, name, price, barcode, itemcode')
              .eq('id', item.inventory_id)
              .single();
            
            if (!inventoryError && inventoryData) {
              item.inventory = inventoryData;
            }
          } catch (err) {
            console.error('Error fetching inventory for item:', item.inventory_id, err);
          }
        }
      }
      
      quotation.items = quotation.items.map((item, index) => ({
        // Ensure unique ID for each item
        id: item.id || Date.now() + index,
        
        // Inventory references
        inventory: item.inventory_id,
        inventory_id: item.inventory_id,
        
        // Item details - use inventory name if available, otherwise use a fallback
        description: item.inventory?.name || `Item ${index + 1}`,
        name: item.inventory?.name || `Item ${index + 1}`,
        
        // Numeric values with proper conversion
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.price) || 0,
        price: Number(item.price) || 0,
        total: Number(item.total) || 0,
        
        // Notes
        notes: item.notes || '',
        
        // Editing properties for the form
        isEditing: false,
        editingQuantity: Number(item.quantity) || 0,
        editingNotes: item.notes || '',
        
        // Additional inventory details if available
        barcode: item.inventory?.barcode || '',
        itemcode: item.inventory?.itemcode || ''
      }));
    } else {
      // Ensure items is always an array
      quotation.items = [];
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (err) {
    console.error('Get quotation error:', err);
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
    // Generate quotation number
    const quotationNumber = `Q-${Date.now()}`;
    
    // Prepare quotation data (without items)
    const quotationData = {
      quotation_number: quotationNumber,
      customer_id: req.body.customer || req.body.customer_id,
      total: req.body.total,
      subtotal: req.body.subtotal || req.body.total,
      tax_amount: req.body.taxAmount || 0,
      discount_amount: req.body.discountAmount || 0,
      status: req.body.status || 'pending',
      notes: req.body.notes || '',
      terms: req.body.terms || '',
      valid_until: req.body.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_by: req.user.id,
      assigned_delivery: req.body.assignedDelivery || null
    };

    // Create quotation first
    const { data: quotation, error } = await supabase
      .from('quotations')
      .insert([quotationData])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    // Create quotation items if provided
    if (req.body.items && req.body.items.length > 0) {
      const quotationItems = req.body.items.map(item => ({
        quotation_id: quotation.id,
        inventory_id: item.inventory || item.inventory_id,
        quantity: item.quantity,
        price: item.unitPrice || item.price,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(quotationItems);

      if (itemsError) {
        console.error('Supabase quotation items insert error:', itemsError);
        // If items insertion fails, we should delete the quotation to maintain consistency
        await supabase.from('quotations').delete().eq('id', quotation.id);
        throw itemsError;
      }
    }

    // Fetch the complete quotation with items for response
    const { data: completeQuotation, error: fetchError } = await supabase
      .from('quotations')
      .select(`
        *,
        quotation_items (*)
      `)
      .eq('id', quotation.id)
      .single();

    if (fetchError) {
      console.error('Error fetching complete quotation:', fetchError);
      // Return the basic quotation if we can't fetch with items
    }

    // Notify admin users about new quotation via WebSocket
    webSocketService.notifyQuotationCreated({
      quotationId: quotation.id,
      quotationNumber: quotation.quotation_number,
      customer: quotation.customer_id,
      total: quotation.total,
      status: quotation.status,
      createdBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      },
      created_at: quotation.created_at
    });

    res.status(201).json({
      success: true,
      data: completeQuotation || quotation
    });
  } catch (err) {
    console.error('Create quotation error:', err);
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
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Allow user role, admin, and superadmin to update quotations
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isUser = req.user.role === 'customer';
    
    if (!isAdmin && !isUser) {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this quotation`
      });
    }

    // Prepare update data with proper field mapping (excluding items)
    const updateData = {
      total: req.body.total,
      subtotal: req.body.subtotal || req.body.total,
      tax_amount: req.body.taxAmount || 0,
      discount_amount: req.body.discountAmount || 0,
      status: req.body.status,
      notes: req.body.notes || '',
      terms: req.body.terms || '',
      assigned_delivery: req.body.assignedDelivery || null
    };

    // Update the quotation
    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      throw updateError;
    }

    // Update quotation items if provided
    if (req.body.items && Array.isArray(req.body.items)) {
      // Delete existing items
      const { error: deleteItemsError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', req.params.id);

      if (deleteItemsError) {
        console.error('Error deleting existing quotation items:', deleteItemsError);
        throw deleteItemsError;
      }

      // Insert new items
      if (req.body.items.length > 0) {
        const quotationItems = req.body.items.map(item => ({
          quotation_id: req.params.id,
          inventory_id: item.inventory || item.inventory_id,
          quantity: item.quantity,
          price: item.unitPrice || item.price,
          total: item.total,
          notes: item.notes || null
        }));

        const { error: insertItemsError } = await supabase
          .from('quotation_items')
          .insert(quotationItems);

        if (insertItemsError) {
          console.error('Error inserting quotation items:', insertItemsError);
          throw insertItemsError;
        }
      }
    }

    // Fetch the complete updated quotation with items
    const { data: completeQuotation, error: fetchCompleteError } = await supabase
      .from('quotations')
      .select(`
        *,
        items:quotation_items(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (fetchCompleteError) {
      console.error('Error fetching complete quotation:', fetchCompleteError);
      // Return the basic quotation if we can't fetch with items
    }

    // Notify admin users about quotation update via WebSocket
    webSocketService.notifyQuotationUpdated({
      quotationId: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotation_number,
      customer: updatedQuotation.customer_id,
      total: updatedQuotation.total,
      status: updatedQuotation.status,
      updatedBy: req.user.id,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      data: completeQuotation || updatedQuotation
    });
  } catch (err) {
    console.error('Update quotation error:', err);
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
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Make sure user is quotation creator or admin/superadmin
    if (quotation.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this quotation`
      });
    }

    // Delete quotation items first
    const { error: itemsDeleteError } = await supabase
      .from('quotation_items')
      .delete()
      .eq('quotation_id', req.params.id);

    if (itemsDeleteError) {
      console.error('Error deleting quotation items:', itemsDeleteError);
      throw itemsDeleteError;
    }

    // Delete the quotation
    const { error: deleteError } = await supabase
      .from('quotations')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      console.error('Error deleting quotation:', deleteError);
      throw deleteError;
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Delete quotation error:', err);
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
    // Get the quotation with customer details
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select(`
        *,
        customer:users!customer_id(id, name, email),
        created_by_user:users!created_by(id, name, email)
      `)
      .eq('id', req.params.id)
      .single();

    if (fetchError || !quotation) {
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
      const { data: deliveryUser, error: deliveryError } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.body.assignedDelivery)
        .single();
      
      if (deliveryError || !deliveryUser || deliveryUser.role !== 'delivery') {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery user selected'
        });
      }
    }

    // Update quotation status and assigned delivery
    const updateData = {
      status: 'approved',
      assigned_delivery: req.body.assignedDelivery || null
    };

    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating quotation:', updateError);
      throw updateError;
    }

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotation: {
        id: updatedQuotation.id,
        quotationNumber: updatedQuotation.quotation_number,
        customer: quotation.customer,
        status: updatedQuotation.status,
        assignedDelivery: updatedQuotation.assigned_delivery,
        createdBy: quotation.created_by_user
      },
      previousStatus: 'pending',
      newStatus: updatedQuotation.status,
      approvedBy: req.user.id,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      data: updatedQuotation
    });
  } catch (err) {
    console.error('Approve quotation error:', err);
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
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !quotation) {
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
    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update({ status: 'rejected' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting quotation:', updateError);
      throw updateError;
    }

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotationId: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotation_number,
      customer: updatedQuotation.customer_id,
      status: updatedQuotation.status,
      rejectedBy: req.user.id,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      data: updatedQuotation
    });
  } catch (err) {
    console.error('Reject quotation error:', err);
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
    const { data: quotation, error: fetchError } = await supabase
      .from('quotations')
      .select(`
        *,
        items:quotation_items(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (fetchError || !quotation) {
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
    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update({ status: 'completed' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating quotation status:', updateError);
      throw updateError;
    }

    // Create sale from quotation data
    // Filter out items with zero quantity for the sale
    const validItems = quotation.items.filter(item => item.quantity > 0);
    
    // Recalculate totals based on valid items only
    const validSubtotal = validItems.reduce((sum, item) => sum + item.total, 0);
    const validTotal = validSubtotal + (quotation.tax_amount || 0) - (quotation.discount_amount || 0);
    
    const saleData = {
      sale_number: `S-${Date.now()}`,
      quotation_id: quotation.id,
      customer_id: quotation.customer_id,
      total: validTotal,
      payment_status: 'pending',
      created_by: req.user.id // Use the delivery user who marked it as delivered
    };

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([saleData])
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      throw saleError;
    }

    console.log('Created sale:', sale);

    // Create sale items from quotation items
    if (validItems && validItems.length > 0) {
      console.log('Creating sale items from quotation items:', validItems);
      
      const saleItems = validItems.map(item => ({
        sale_id: sale.id,
        inventory_id: item.inventory_id,
        description: item.inventory?.name || `Item ${item.inventory_id}`,
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.price),
        total: parseFloat(item.total)
      }));

      console.log('Prepared sale items:', saleItems);

      const { data: createdItems, error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)
        .select();

      if (itemsError) {
        console.error('Sale items creation error:', itemsError);
        console.error('Error details:', JSON.stringify(itemsError, null, 2));
      } else {
        console.log('Created sale items successfully:', createdItems);
      }
    }

    // Update inventory quantities
    for (const item of quotation.items) {
      const { data: inventoryItem, error: inventoryFetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', item.inventory_id)
        .single();

      if (!inventoryFetchError && inventoryItem) {
        const { error: inventoryUpdateError } = await supabase
          .from('inventory')
          .update({ quantity: inventoryItem.quantity - item.quantity })
          .eq('id', item.inventory_id);

        if (inventoryUpdateError) {
          console.error('Error updating inventory:', inventoryUpdateError);
        }
      }
    }

    // Notify all users about quotation status change via WebSocket
    webSocketService.notifyQuotationStatusChanged({
      quotationId: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotation_number,
      customer: updatedQuotation.customer_id,
      status: updatedQuotation.status,
      deliveredBy: req.user.id,
      saleCreated: sale.id,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      data: {
        quotation: updatedQuotation,
        sale
      }
    });
  } catch (err) {
    console.error('Mark as delivered error:', err);
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

    const { data: deliveryUsers, error } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .eq('role', 'delivery');

    if (error) {
      console.error('Error fetching delivery users:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      data: deliveryUsers || []
    });
  } catch (err) {
    console.error('Get delivery users error:', err);
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
    const { data: quotation, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation not found with id of ${req.params.id}`
      });
    }

    // Check if user owns the quotation (unless admin)
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const quotationCreatorId = quotation.created_by; // Supabase uses created_by
    const currentUserId = req.user.id;
    
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
      const { data: updatedQuotation, error: updateError } = await supabase
        .from('quotations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancelled_by: req.user.id,
          cancellation_reason: req.body.reason || 'No reason provided'
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error cancelling quotation:', updateError);
        throw updateError;
      }

      // Notify admin and related users
      webSocketService.notifyQuotationStatusChanged({
        quotationId: updatedQuotation.id,
        quotationNumber: updatedQuotation.quotation_number,
        customer: updatedQuotation.customer_id,
        status: updatedQuotation.status,
        cancelledBy: req.user.id,
        cancellationReason: updatedQuotation.cancellation_reason,
        updated_at: new Date()
      });

      return res.status(200).json({
        success: true,
        message: 'Quotation cancelled successfully',
        data: updatedQuotation
      });
    }

    // Request cancellation for later stages (approved/accepted)
    if (['approved', 'accepted'].includes(quotation.status)) {
      const { data: updatedQuotation, error: updateError } = await supabase
        .from('quotations')
        .update({
          status: 'cancellation_requested',
          cancellation_requested_at: new Date(),
          cancellation_requested_by: req.user.id,
          cancellation_reason: req.body.reason || 'No reason provided'
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error requesting cancellation:', updateError);
        throw updateError;
      }

      // Notify admin for approval
      webSocketService.notifyQuotationStatusChanged({
        quotationId: updatedQuotation.id,
        quotationNumber: updatedQuotation.quotation_number,
        customer: updatedQuotation.customer_id,
        status: updatedQuotation.status,
        cancellationRequestedBy: req.user.id,
        cancellationReason: updatedQuotation.cancellation_reason,
        updated_at: new Date()
      });

      return res.status(200).json({
        success: true,
        message: 'Cancellation request submitted. Waiting for admin approval.',
        data: updatedQuotation
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

    const { data: quotation, error } = await supabase
      .from('quotations')
      .select(`
        *,
        items:quotation_items(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !quotation) {
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

    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancelled_by: req.user.id
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving cancellation:', updateError);
      throw updateError;
    }

    // Notify user and delivery personnel
    webSocketService.notifyQuotationStatusChanged({
      quotationId: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotation_number,
      customer: updatedQuotation.customer_id,
      status: updatedQuotation.status,
      cancelledBy: req.user.id,
      cancellationApprovedBy: req.user.id,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Cancellation approved successfully',
      data: updatedQuotation
    });
  } catch (err) {
    console.error('Approve cancellation error:', err);
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

    const { data: quotation, error } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !quotation) {
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
    const originalStatus = quotation.cancellation_requested_by ? 'approved' : 'pending';
    
    const { data: updatedQuotation, error: updateError } = await supabase
      .from('quotations')
      .update({
        status: originalStatus,
        cancellation_requested_at: null,
        cancellation_requested_by: null,
        cancellation_reason: null
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error denying cancellation:', updateError);
      throw updateError;
    }

    // Notify user that cancellation was denied
    webSocketService.notifyQuotationStatusChanged({
      quotationId: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotation_number,
      customer: updatedQuotation.customer_id,
      status: updatedQuotation.status,
      cancellationDeniedBy: req.user.id,
      denialReason: req.body.reason || 'Cancellation request denied',
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Cancellation request denied',
      data: updatedQuotation
    });
  } catch (err) {
    console.error('Deny cancellation error:', err);
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
    const { data: inventoryItem, error: inventoryFetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', item.inventory_id)
      .single();
    
    if (!inventoryFetchError && inventoryItem) {
      const { error: inventoryUpdateError } = await supabase
        .from('inventory')
        .update({ quantity: inventoryItem.quantity + item.quantity })
        .eq('id', item.inventory_id);

      if (inventoryUpdateError) {
        console.error('Error restoring inventory quantity:', inventoryUpdateError);
      }
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
    const quotation = await supabase.from('Quotation').select('*').eq('id', req.params.id).single();

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

    // Check if user is authorized to convert (only customer role can convert)
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can convert quotations to sales'
      });
    }

    // Update quotation status
    quotation.status = 'completed';
    await quotation.save();

    // Create sale from quotation data
        // Filter out items with zero quantity for the sale
    const validItems = quotation.items.filter(item => item.quantity > 0);
    
    // Recalculate totals based on valid items only
    const validSubtotal = validItems.reduce((sum, item) => sum + item.total, 0);
    const validTotal = validSubtotal + (quotation.taxAmount || 0) - (quotation.discountAmount || 0);
    
    const saleData = {
      sale_number: `S-${Date.now()}`,
      quotation_id: quotation.id,
      customer_id: quotation.customer_id,
      total: validTotal,
      payment_status: 'pending',
      created_by: req.user.id
    };

    const sale = await supabase.from('Sale').insert([saleData]).select().single();

    // Update inventory quantities
    for (const item of quotation.items) {
      const inventoryItem = await supabase.from('Inventory').select('*').eq('id', item.inventory).single();
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
      updated_at: new Date()
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
