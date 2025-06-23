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
    
    // Create search filter
    const searchFilter = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { barcode: { $regex: query, $options: 'i' } },
        { itemcode: parseInt(query) || 0 }
      ]
    };
    
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
 * @desc    Import inventory items from Excel file
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

    let imported = 0;
    let errors = [];

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      try {
        // Map Excel columns to inventory fields
        // Expected columns: itemcode, name, barcode, unit, cost, price
        const inventoryItem = {
          itemcode: row.itemcode || row.ItemCode || row['Item Code'],
          name: row.name || row.Name || row['Item Name'],
          barcode: row.barcode || row.Barcode || row['Bar Code'],
          unit: row.unit || row.Unit || 'pcs',
          cost: parseFloat(row.cost || row.Cost || 0),
          price: parseFloat(row.price || row.Price || 0)
        };

        // Validate required fields
        if (!inventoryItem.name) {
          errors.push(`Row ${i + 1}: Name is required`);
          continue;
        }

        if (!inventoryItem.itemcode) {
          errors.push(`Row ${i + 1}: Item code is required`);
          continue;
        }

        // Check if item already exists
        const existingItem = await Inventory.findOne({
          $or: [
            { itemcode: inventoryItem.itemcode },
            { barcode: inventoryItem.barcode }
          ]
        });

        if (existingItem) {
          // Update existing item
          await Inventory.findByIdAndUpdate(existingItem._id, inventoryItem, {
            new: true,
            runValidators: true
          });
        } else {
          // Create new item
          await Inventory.create(inventoryItem);
        }

        imported++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${imported} items from Excel file`,
      data: {
        imported,
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
