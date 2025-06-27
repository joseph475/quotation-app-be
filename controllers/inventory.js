const { supabase } = require('../config/supabase');
const XLSX = require('xlsx');

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
    
    // Search in Supabase using ilike for case-insensitive search
    let searchQuery = supabase.from('inventory').select('*');
    
    // Check if query is a number (for itemcode search)
    const numericQuery = parseInt(query);
    if (!isNaN(numericQuery)) {
      // Search by itemcode if it's a number
      searchQuery = searchQuery.eq('itemcode', numericQuery);
    } else {
      // Search by name or barcode using ilike (case-insensitive)
      searchQuery = searchQuery.or(`name.ilike.%${query}%,barcode.ilike.%${query}%`);
    }
    
    const { data: inventory, error } = await searchQuery;
    
    if (error) throw error;
    
    res.status(200).json({
      success: true,
      count: inventory?.length || 0,
      data: inventory || []
    });
  } catch (err) {
    console.error('Search inventory error:', err);
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
    // Build Supabase query
    let query = supabase.from('inventory').select('*');

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
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Apply pagination
    query = query.range(startIndex, startIndex + limit - 1);

    // Execute query
    const { data: inventory, error } = await query;

    if (error) throw error;

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
      count: inventory?.length || 0,
      total: total || 0,
      pagination,
      data: inventory || []
    });
  } catch (err) {
    console.error('Get inventory error:', err);
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
    const { data: item, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !item) {
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
    console.error('Get inventory item error:', err);
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
    const { data: item, error } = await supabase
      .from('inventory')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (err) {
    console.error('Create inventory item error:', err);
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
    const { data: item, error } = await supabase
      .from('inventory')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

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
    console.error('Update inventory item error:', err);
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
    // Check if ID is provided
    if (!req.params.id || req.params.id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid inventory item ID provided'
      });
    }

    // Check if item exists first
    const { data: item, error: selectError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (selectError || !item) {
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id of ${req.params.id}`
      });
    }

    // Delete the item
    const { error: deleteError } = await supabase
      .from('inventory')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Delete inventory item error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Import inventory items from Excel file with chunked processing for Vercel
 * @route   POST /api/v1/inventory/import-excel-batch
 * @access  Private/Superadmin
 */
exports.importExcelBatch = async (req, res) => {
  try {
    // Check if user is superadmin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only superadmin can import Excel files.'
      });
    }

    const { chunk, chunkIndex, totalChunks, sessionId } = req.body;

    // If this is the initial file upload (no chunkIndex), we expect the Excel file
    if (chunkIndex === undefined && !chunk) {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an Excel file'
        });
      }

      // Parse Excel file and store in temporary storage (you might want to use Redis or database)
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData || jsonData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Excel file is empty or invalid'
        });
      }

      // Store the parsed data temporarily (in a real app, use Redis or database)
      // For now, we'll return the data to be processed by frontend in chunks
      const CHUNK_SIZE = 300; // Optimized chunk size for maximum performance while staying safe
      const chunks = [];
      
      for (let i = 0; i < jsonData.length; i += CHUNK_SIZE) {
        chunks.push(jsonData.slice(i, i + CHUNK_SIZE));
      }

      return res.status(200).json({
        success: true,
        message: `Excel file parsed successfully. ${jsonData.length} rows found.`,
        data: {
          totalRows: jsonData.length,
          totalChunks: chunks.length,
          chunkSize: CHUNK_SIZE,
          sessionId: Date.now().toString(), // Simple session ID
          chunks: chunks // Return all chunks for frontend processing
        }
      });
    }

    // Process a specific chunk
    if (chunk && Array.isArray(chunk)) {
      let imported = 0;
      let updated = 0;
      let created = 0;
      let errors = [];

      // Process chunk items
      const chunkPromises = chunk.map(async (row, index) => {
        try {
          // Map Excel columns to inventory fields
          const inventoryItem = {
            itemcode: row.itemcode || row.ItemCode || row['Item Code'] || row['ITEM CODE'] || 
                     row.item_code || row.code || row.Code || row.ID || row.id,
            name: row.name || row.Name || row['Item Name'] || row['ITEM NAME'] || 
                  row.item_name || row.description || row.Description || row.DESCRIPTION ||
                  row.product || row.Product || row.PRODUCT,
            barcode: row.barcode || row.Barcode || row['Bar Code'] || row['BAR CODE'] || 
                    row.bar_code || row.ean || row.EAN || row.upc || row.UPC,
            unit: row.unit || row.Unit || row.UNIT || row.uom || row.UOM || 'pcs',
            cost: parseFloat(row.cost || row.Cost || row.COST || row.purchase_price || 
                           row['Purchase Price'] || row.buy_price || 0),
            price: parseFloat(row.price || row.Price || row.PRICE || row.sell_price || 
                            row['Sell Price'] || row.selling_price || 0)
          };

          // Validate required fields
          if (!inventoryItem.name || inventoryItem.name.toString().trim() === '') {
            return { error: `Row ${(chunkIndex * 300) + index + 1}: Name is required` };
          }

          // Clean up the data
          inventoryItem.name = inventoryItem.name.toString().trim();
          
          // Handle itemcode
          if (inventoryItem.itemcode && inventoryItem.itemcode.toString().trim() !== '') {
            const itemcodeNum = parseInt(inventoryItem.itemcode.toString().trim());
            if (!isNaN(itemcodeNum)) {
              inventoryItem.itemcode = itemcodeNum;
            } else {
              delete inventoryItem.itemcode;
            }
          } else {
            delete inventoryItem.itemcode;
          }
          
          if (inventoryItem.barcode) {
            inventoryItem.barcode = inventoryItem.barcode.toString().trim();
          }

          // Check if item already exists
          let existingItem = null;
          
          if (inventoryItem.itemcode) {
            const { data, error } = await supabase
              .from('inventory')
              .select('*')
              .eq('itemcode', inventoryItem.itemcode)
              .single();
            
            if (!error && data) {
              existingItem = data;
            }
          }
          
          if (!existingItem && inventoryItem.barcode) {
            const { data, error } = await supabase
              .from('inventory')
              .select('*')
              .eq('barcode', inventoryItem.barcode)
              .single();
            
            if (!error && data) {
              existingItem = data;
            }
          }

          if (existingItem) {
            // Update existing item
            const updateData = {
              name: inventoryItem.name,
              barcode: inventoryItem.barcode,
              unit: inventoryItem.unit,
              cost: inventoryItem.cost,
              price: inventoryItem.price,
              updated_at: new Date().toISOString()
            };
            
            const { data: updatedItem, error: updateError } = await supabase
              .from('inventory')
              .update(updateData)
              .eq('id', existingItem.id)
              .select()
              .single();
            
            if (updateError) throw updateError;
            
            return { type: 'updated', name: inventoryItem.name };
          } else {
            // Create new item
            const { data: newItem, error: insertError } = await supabase
              .from('inventory')
              .insert([inventoryItem])
              .select()
              .single();
            
            if (insertError) throw insertError;
            
            return { type: 'created', name: inventoryItem.name };
          }
        } catch (error) {
          return { error: `Row ${(chunkIndex * 50) + index + 1}: ${error.message}` };
        }
      });
      
      // Wait for chunk to complete
      const chunkResults = await Promise.all(chunkPromises);
      
      // Process results
      chunkResults.forEach(result => {
        if (result.error) {
          errors.push(result.error);
        } else if (result.type === 'updated') {
          updated++;
          imported++;
        } else if (result.type === 'created') {
          created++;
          imported++;
        }
      });

      return res.status(200).json({
        success: true,
        message: `Chunk ${chunkIndex + 1} of ${totalChunks} processed successfully`,
        data: {
          chunkIndex,
          totalChunks,
          processed: chunk.length,
          created,
          updated,
          errors: errors.length,
          errorDetails: errors.slice(0, 5) // Limit errors shown per chunk
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid request format'
    });

  } catch (err) {
    console.error('Excel import error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to import Excel file'
    });
  }
};

/**
 * @desc    Import inventory items from Excel file (original method)
 * @route   POST /api/v1/inventory/import-excel
 * @access  Private/Superadmin
 */
exports.importExcel = async (req, res) => {
  try {
    // Check if user is superadmin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only superadmin can import Excel files.'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an Excel file'
      });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is empty or invalid'
      });
    }

    // Debug: Log the first few rows to understand the Excel structure
    console.log('Excel file analysis:');
    console.log('Total rows:', jsonData.length);
    console.log('First row keys:', Object.keys(jsonData[0] || {}));
    console.log('First 3 rows sample:', jsonData.slice(0, 3));
    
    // Check if we have any data in the first row
    const firstRow = jsonData[0];
    if (firstRow && Object.keys(firstRow).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel file appears to have empty rows or incorrect format'
      });
    }

    let imported = 0;
    let updated = 0;
    let created = 0;
    let errors = [];

    // Count existing items before import for comparison
    const { count: existingItemsCount, error: countError } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    console.log(`Starting import: ${existingItemsCount} items currently in database`);

    // Process data in batches to prevent timeouts
    const BATCH_SIZE = 100; // Process 100 items at a time for better performance
    const totalRows = jsonData.length;
    
    console.log(`Processing ${totalRows} rows in batches of ${BATCH_SIZE}`);
    
    for (let batchStart = 0; batchStart < totalRows; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
      const batch = jsonData.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: rows ${batchStart + 1} to ${batchEnd}`);
      
      // Process batch items in parallel for better performance
      const batchPromises = batch.map(async (row, index) => {
        const rowIndex = batchStart + index;
        
        try {
          // Map Excel columns to inventory fields with more flexible column name matching
          const inventoryItem = {
            itemcode: row.itemcode || row.ItemCode || row['Item Code'] || row['ITEM CODE'] || 
                     row.item_code || row.code || row.Code || row.ID || row.id,
            name: row.name || row.Name || row['Item Name'] || row['ITEM NAME'] || 
                  row.item_name || row.description || row.Description || row.DESCRIPTION ||
                  row.product || row.Product || row.PRODUCT,
            barcode: row.barcode || row.Barcode || row['Bar Code'] || row['BAR CODE'] || 
                    row.bar_code || row.ean || row.EAN || row.upc || row.UPC,
            unit: row.unit || row.Unit || row.UNIT || row.uom || row.UOM || 'pcs',
            cost: parseFloat(row.cost || row.Cost || row.COST || row.purchase_price || 
                           row['Purchase Price'] || row.buy_price || 0),
            price: parseFloat(row.price || row.Price || row.PRICE || row.sell_price || 
                            row['Sell Price'] || row.selling_price || 0)
          };

          // Log the first few rows to help debug column mapping
          if (rowIndex < 3) {
            console.log(`Row ${rowIndex + 1} raw data:`, Object.keys(row));
            console.log(`Row ${rowIndex + 1} mapped:`, inventoryItem);
          }

          // Validate required fields
          if (!inventoryItem.name || inventoryItem.name.toString().trim() === '') {
            return { error: `Row ${rowIndex + 1}: Name is required. Available columns: ${Object.keys(row).join(', ')}` };
          }

          // Clean up the data
          inventoryItem.name = inventoryItem.name.toString().trim();
          
          // Handle itemcode - convert to number if provided, otherwise it will be auto-generated
          if (inventoryItem.itemcode && inventoryItem.itemcode.toString().trim() !== '') {
            const itemcodeNum = parseInt(inventoryItem.itemcode.toString().trim());
            if (!isNaN(itemcodeNum)) {
              inventoryItem.itemcode = itemcodeNum;
            } else {
              delete inventoryItem.itemcode; // Let it auto-generate
            }
          } else {
            delete inventoryItem.itemcode; // Let it auto-generate
          }
          
          if (inventoryItem.barcode) {
            inventoryItem.barcode = inventoryItem.barcode.toString().trim();
          }

          // Check if item already exists
          let existingItem = null;
          
          // First check by itemcode
          if (inventoryItem.itemcode) {
            const { data, error } = await supabase
              .from('inventory')
              .select('*')
              .eq('itemcode', inventoryItem.itemcode)
              .single();
            
            if (!error && data) {
              existingItem = data;
            }
          }
          
          // If not found by itemcode and barcode exists, check by barcode
          if (!existingItem && inventoryItem.barcode) {
            const { data, error } = await supabase
              .from('inventory')
              .select('*')
              .eq('barcode', inventoryItem.barcode)
              .single();
            
            if (!error && data) {
              existingItem = data;
            }
          }

          if (existingItem) {
            // Update existing item
            const updateData = {
              name: inventoryItem.name,
              barcode: inventoryItem.barcode,
              unit: inventoryItem.unit,
              cost: inventoryItem.cost,
              price: inventoryItem.price,
              updated_at: new Date().toISOString()
            };
            
            const { data: updatedItem, error: updateError } = await supabase
              .from('inventory')
              .update(updateData)
              .eq('id', existingItem.id)
              .select()
              .single();
            
            if (updateError) throw updateError;
            
            return { type: 'updated', name: inventoryItem.name };
          } else {
            // Create new item
            const { data: newItem, error: insertError } = await supabase
              .from('inventory')
              .insert([inventoryItem])
              .select()
              .single();
            
            if (insertError) throw insertError;
            
            return { type: 'created', name: inventoryItem.name };
          }
        } catch (error) {
          console.log(`Error in row ${rowIndex + 1}:`, error.message);
          console.log(`Row data:`, row);
          return { error: `Row ${rowIndex + 1}: ${error.message}` };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      batchResults.forEach(result => {
        if (result.error) {
          errors.push(result.error);
        } else if (result.type === 'updated') {
          updated++;
          imported++;
        } else if (result.type === 'created') {
          created++;
          imported++;
        }
      });
      
      // Log progress
      console.log(`Batch completed: ${imported}/${totalRows} processed, ${created} created, ${updated} updated, ${errors.length} errors`);
    }

    // Count items after import for verification
    const { count: finalItemsCount, error: finalCountError } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });
    
    if (finalCountError) throw finalCountError;
    
    console.log(`Import completed: ${finalItemsCount} total items in database (was ${existingItemsCount})`);
    console.log(`Import summary: ${created} created, ${updated} updated, ${errors.length} errors`);
    
    // Log some items after import for debugging
    const { data: finalItems, error: finalItemsError } = await supabase
      .from('inventory')
      .select('id, itemcode, barcode, name')
      .limit(10);
    
    if (!finalItemsError && finalItems) {
      console.log('Sample items after import:', finalItems.map(item => ({
        id: item.id,
        itemcode: item.itemcode,
        barcode: item.barcode,
        name: item.name
      })));
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${imported} items from Excel file (${created} created, ${updated} updated)`,
      data: {
        imported,
        created,
        updated,
        beforeCount: existingItemsCount,
        afterCount: finalItemsCount,
        errors: errors.length > 0 ? errors : undefined,
        totalRows: jsonData.length
      }
    });

  } catch (err) {
    console.error('Excel import error:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Failed to import Excel file'
    });
  }
};
