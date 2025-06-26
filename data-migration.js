const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB Models (import your existing models)
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Quotation = require('./models/Quotation');
const Customer = require('./models/Customer');
const Sale = require('./models/Sale');
const InventoryHistory = require('./models/InventoryHistory');
const CostHistory = require('./models/CostHistory');
const DeviceFingerprint = require('./models/DeviceFingerprint');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MongoDB connection
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Helper function to convert MongoDB ObjectId to UUID mapping
const idMapping = new Map();

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const mapId = (mongoId) => {
  if (!mongoId) return null;
  const mongoIdStr = mongoId.toString();
  if (!idMapping.has(mongoIdStr)) {
    idMapping.set(mongoIdStr, generateUUID());
  }
  return idMapping.get(mongoIdStr);
};

// Migration functions
const migrateUsers = async () => {
  console.log('Migrating users...');
  
  try {
    const users = await User.find({});
    console.log(`Found ${users.length} users to migrate`);
    
    const supabaseUsers = users.map(user => ({
      id: mapId(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      department: user.department || null,
      address: user.address || null,
      is_active: user.isActive,
      role: user.role === 'user' ? 'customer' : user.role, // Convert 'user' to 'customer'
      password_hash: user.password, // Already hashed
      reset_password_token: user.resetPasswordToken || null,
      reset_password_expire: user.resetPasswordExpire || null,
      created_at: user.createdAt,
      updated_at: user.updatedAt || user.createdAt
    }));
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < supabaseUsers.length; i += batchSize) {
      const batch = supabaseUsers.slice(i, i + batchSize);
      const { error } = await supabase
        .from('users')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting users batch:', error);
      } else {
        console.log(`Inserted users batch ${Math.floor(i/batchSize) + 1}`);
      }
    }
    
    console.log('Users migration completed');
  } catch (error) {
    console.error('Error migrating users:', error);
  }
};

const migrateInventory = async () => {
  console.log('Migrating inventory...');
  
  try {
    const inventory = await Inventory.find({});
    console.log(`Found ${inventory.length} inventory items to migrate`);
    
    const supabaseInventory = inventory.map(item => ({
      id: mapId(item._id),
      itemcode: item.itemcode,
      barcode: item.barcode || null,
      name: item.name,
      unit: item.unit,
      cost: item.cost,
      price: item.price,
      created_at: item.createdAt,
      updated_at: item.updatedAt || item.createdAt
    }));
    
    const batchSize = 100;
    for (let i = 0; i < supabaseInventory.length; i += batchSize) {
      const batch = supabaseInventory.slice(i, i + batchSize);
      const { error } = await supabase
        .from('inventory')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting inventory batch:', error);
      } else {
        console.log(`Inserted inventory batch ${Math.floor(i/batchSize) + 1}`);
      }
    }
    
    console.log('Inventory migration completed');
  } catch (error) {
    console.error('Error migrating inventory:', error);
  }
};

const migrateQuotations = async () => {
  console.log('Migrating quotations...');
  
  try {
    const quotations = await Quotation.find({}).populate('items.inventory');
    console.log(`Found ${quotations.length} quotations to migrate`);
    
    for (const quotation of quotations) {
      const quotationId = mapId(quotation._id);
      
      // Insert quotation
      const supabaseQuotation = {
        id: quotationId,
        quotation_number: quotation.quotationNumber,
        customer_id: mapId(quotation.customer),
        subtotal: quotation.subtotal,
        tax_amount: quotation.taxAmount,
        discount_amount: quotation.discountAmount,
        total: quotation.total,
        status: quotation.status,
        cancellation_reason: quotation.cancellationReason || null,
        cancellation_requested_at: quotation.cancellationRequestedAt || null,
        cancellation_requested_by: mapId(quotation.cancellationRequestedBy) || null,
        cancelled_at: quotation.cancelledAt || null,
        cancelled_by: mapId(quotation.cancelledBy) || null,
        assigned_delivery: mapId(quotation.assignedDelivery) || null,
        valid_until: quotation.validUntil || null,
        notes: quotation.notes || null,
        terms: quotation.terms || null,
        created_by: mapId(quotation.createdBy),
        created_at: quotation.createdAt,
        updated_at: quotation.updatedAt || quotation.createdAt
      };
      
      const { error: quotationError } = await supabase
        .from('quotations')
        .insert(supabaseQuotation);
      
      if (quotationError) {
        console.error('Error inserting quotation:', quotationError);
        continue;
      }
      
      // Insert quotation items
      if (quotation.items && quotation.items.length > 0) {
        const supabaseItems = quotation.items.map(item => ({
          id: generateUUID(),
          quotation_id: quotationId,
          inventory_id: mapId(item.inventory),
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
          tax: item.tax,
          total: item.total,
          notes: item.notes || '',
          created_at: quotation.createdAt
        }));
        
        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(supabaseItems);
        
        if (itemsError) {
          console.error('Error inserting quotation items:', itemsError);
        }
      }
    }
    
    console.log('Quotations migration completed');
  } catch (error) {
    console.error('Error migrating quotations:', error);
  }
};

// Add more migration functions for other models...
const migrateInventoryHistory = async () => {
  console.log('Migrating inventory history...');
  
  try {
    const history = await InventoryHistory.find({});
    console.log(`Found ${history.length} inventory history records to migrate`);
    
    const supabaseHistory = history.map(record => ({
      id: mapId(record._id),
      inventory_id: mapId(record.inventory),
      transaction_type: record.transactionType,
      quantity_change: record.quantityChange,
      quantity_before: record.quantityBefore,
      quantity_after: record.quantityAfter,
      reference_id: mapId(record.referenceId) || null,
      reference_type: record.referenceType || null,
      notes: record.notes || null,
      created_by: mapId(record.createdBy) || null,
      created_at: record.createdAt
    }));
    
    const batchSize = 100;
    for (let i = 0; i < supabaseHistory.length; i += batchSize) {
      const batch = supabaseHistory.slice(i, i + batchSize);
      const { error } = await supabase
        .from('inventory_history')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting inventory history batch:', error);
      } else {
        console.log(`Inserted inventory history batch ${Math.floor(i/batchSize) + 1}`);
      }
    }
    
    console.log('Inventory history migration completed');
  } catch (error) {
    console.error('Error migrating inventory history:', error);
  }
};

// Main migration function
const runMigration = async () => {
  console.log('Starting data migration from MongoDB to Supabase...');
  
  try {
    await connectMongoDB();
    
    // Run migrations in order (respecting foreign key constraints)
    await migrateUsers();
    await migrateInventory();
    await migrateQuotations();
    await migrateInventoryHistory();
    // Add more migrations as needed...
    
    console.log('Migration completed successfully!');
    console.log(`Total ID mappings created: ${idMapping.size}`);
    
    // Save ID mappings for reference
    const mappingData = Object.fromEntries(idMapping);
    require('fs').writeFileSync('id-mappings.json', JSON.stringify(mappingData, null, 2));
    console.log('ID mappings saved to id-mappings.json');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Export data only (for backup)
const exportData = async () => {
  console.log('Exporting MongoDB data...');
  
  try {
    await connectMongoDB();
    
    const users = await User.find({});
    const inventory = await Inventory.find({});
    const quotations = await Quotation.find({}).populate('items.inventory');
    
    const exportData = {
      users,
      inventory,
      quotations,
      exportDate: new Date().toISOString()
    };
    
    require('fs').writeFileSync('mongodb-export.json', JSON.stringify(exportData, null, 2));
    console.log('Data exported to mongodb-export.json');
    
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigration();
    break;
  case 'export':
    exportData();
    break;
  default:
    console.log('Usage: node data-migration.js [migrate|export]');
    console.log('  migrate - Migrate data from MongoDB to Supabase');
    console.log('  export  - Export MongoDB data to JSON file');
}
