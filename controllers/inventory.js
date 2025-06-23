const Inventory = require('../models/Inventory');
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
    
    // Create search filter - handle potential null/undefined barcode values
    const searchConditions = [
      { name: { $regex: query, $options: 'i' } },
      { itemcode: parseInt(query) || 0 }
    ];
    
    // Only add barcode search if query is not a number (to avoid regex errors)
    if (isNaN(parseInt(query))) {
      searchConditions.push({ 
        barcode: { 
          $regex: query, 
          $options: 'i',
          $ne: null // Exclude null barcodes from regex search
        } 
      });
    }
    
    const searchFilter = { $or: searchConditions };
    
    const inventory = await Inventory.find(searchFilter);
    
    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (err) {
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
    let query = Inventory.find(JSON.parse(queryStr));

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
    const total = await Inventory.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const inventory = await query;

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
      count: inventory.length,
      total: total,
      pagination,
      data: inventory
    });
  } catch (err) {
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
    const item = await Inventory.findById(req.params.id);

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
    const item = await Inventory.create(req.body);

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (err) {
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
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

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
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Inventory item not found with id of ${req.params.id}`
      });
    }

    await item.deleteOne();

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
            existingItem = await Inventory.findOne({ itemcode: inventoryItem.itemcode });
          }
          
          if (!existingItem && inventoryItem.barcode) {
            existingItem = await Inventory.findOne({ barcode: inventoryItem.barcode });
          }

          if (existingItem) {
            // Update existing item
            const updateData = {
              name: inventoryItem.name,
              barcode: inventoryItem.barcode,
              unit: inventoryItem.unit,
              cost: inventoryItem.cost,
              price: inventoryItem.price,
              itemcode: existingItem.itemcode
            };
            
            await Inventory.findByIdAndUpdate(existingItem._id, updateData, {
              new: true,
              runValidators: true
            });
            
            return { type: 'updated', name: inventoryItem.name };
          } else {
            // Create new item
            await Inventory.create(inventoryItem);
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
    const existingItemsCount = await Inventory.countDocuments();
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
            existingItem = await Inventory.findOne({ itemcode: inventoryItem.itemcode });
          }
          
          // If not found by itemcode and barcode exists, check by barcode
          if (!existingItem && inventoryItem.barcode) {
            existingItem = await Inventory.findOne({ barcode: inventoryItem.barcode });
          }

          if (existingItem) {
            // Update existing item
            const updateData = {
              name: inventoryItem.name,
              barcode: inventoryItem.barcode,
              unit: inventoryItem.unit,
              cost: inventoryItem.cost,
              price: inventoryItem.price,
              itemcode: existingItem.itemcode // Preserve original itemcode
            };
            
            await Inventory.findByIdAndUpdate(existingItem._id, updateData, {
              new: true,
              runValidators: true
            });
            
            return { type: 'updated', name: inventoryItem.name };
          } else {
            // Create new item
            await Inventory.create(inventoryItem);
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
    const finalItemsCount = await Inventory.countDocuments();
    console.log(`Import completed: ${finalItemsCount} total items in database (was ${existingItemsCount})`);
    console.log(`Import summary: ${created} created, ${updated} updated, ${errors.length} errors`);
    
    // Log all items after import for debugging
    const finalItems = await Inventory.find({}, 'itemcode barcode name').lean();
    console.log('Items after import:', finalItems.map(item => ({
      id: item._id,
      itemcode: item.itemcode,
      barcode: item.barcode,
      name: item.name
    })));

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
