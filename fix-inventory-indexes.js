const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const fixInventoryIndexes = async () => {
  try {
    console.log('Starting inventory index fix process...');
    
    // Get the collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('inventories');
    
    // 1. List current indexes
    console.log('Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`- ${index.name}:`, index.key);
    });
    
    // 2. Drop the problematic itemCode index if it exists
    try {
      await collection.dropIndex('itemCode_1');
      console.log('✅ Dropped itemCode_1 index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  itemCode_1 index not found (already dropped or doesn\'t exist)');
      } else {
        console.log('⚠️  Error dropping itemCode_1 index:', error.message);
      }
    }
    
    // 3. Drop any other problematic itemcode indexes
    try {
      await collection.dropIndex('itemcode_1');
      console.log('✅ Dropped itemcode_1 index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  itemcode_1 index not found (already dropped or doesn\'t exist)');
      } else {
        console.log('⚠️  Error dropping itemcode_1 index:', error.message);
      }
    }
    
    // 4. Create the correct unique index for itemcode
    try {
      await collection.createIndex({ itemcode: 1 }, { unique: true, name: 'itemcode_unique' });
      console.log('✅ Created unique itemcode index');
    } catch (error) {
      console.log('⚠️  Error creating itemcode index:', error.message);
    }
    
    // 5. Fix barcode index to be sparse (allow multiple nulls)
    try {
      await collection.dropIndex('barcode_1');
      console.log('✅ Dropped old barcode index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  barcode_1 index not found');
      } else {
        console.log('⚠️  Error dropping barcode index:', error.message);
      }
    }
    
    try {
      await collection.createIndex({ barcode: 1 }, { unique: true, sparse: true, name: 'barcode_unique_sparse' });
      console.log('✅ Created sparse unique barcode index');
    } catch (error) {
      console.log('⚠️  Error creating barcode index:', error.message);
    }
    
    // 6. List final indexes
    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`- ${index.name}:`, index.key, index.unique ? '(unique)' : '', index.sparse ? '(sparse)' : '');
    });
    
    console.log('Index fix process completed!');
    
  } catch (error) {
    console.error('Error during index fix process:', error);
  }
};

const main = async () => {
  await connectDB();
  await fixInventoryIndexes();
  await mongoose.connection.close();
  console.log('Database connection closed.');
};

main().catch(console.error);
