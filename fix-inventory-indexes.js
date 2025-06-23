const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB Connected...');
  
  try {
    // Get the Inventory collection
    const db = mongoose.connection.db;
    const inventoryCollection = db.collection('inventories');
    
    console.log('Current indexes:');
    const indexes = await inventoryCollection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // Drop problematic indexes
    const indexesToDrop = [];
    
    for (const index of indexes) {
      // Drop the old itemCode_1_branch_1 index if it exists
      if (index.key && index.key.itemCode === 1 && index.key.branch === 1) {
        indexesToDrop.push(index.name);
      }
      
      // Drop any old itemcode indexes
      if (index.key && index.key.itemcode === 1) {
        indexesToDrop.push(index.name);
      }
      
      // Drop old barcode unique index (we'll recreate it with branch)
      if (index.key && index.key.barcode === 1 && Object.keys(index.key).length === 1) {
        indexesToDrop.push(index.name);
      }
    }
    
    // Drop the problematic indexes
    for (const indexName of indexesToDrop) {
      try {
        console.log(`Dropping index: ${indexName}`);
        await inventoryCollection.dropIndex(indexName);
        console.log(`Successfully dropped index: ${indexName}`);
      } catch (error) {
        console.log(`Could not drop index ${indexName}:`, error.message);
      }
    }
    
    // Remove any documents with null itemCode or branch values
    console.log('\nRemoving documents with null itemCode or branch values...');
    const deleteResult = await inventoryCollection.deleteMany({
      $or: [
        { itemCode: null },
        { branch: null },
        { itemCode: { $exists: false } },
        { branch: { $exists: false } }
      ]
    });
    console.log(`Removed ${deleteResult.deletedCount} documents with null values`);
    
    // Check for any remaining documents with old schema
    console.log('\nChecking for documents with old schema...');
    const oldSchemaCount = await inventoryCollection.countDocuments({
      $or: [
        { itemcode: { $exists: true } },
        { cost: { $exists: true } },
        { price: { $exists: true } }
      ]
    });
    
    if (oldSchemaCount > 0) {
      console.log(`Found ${oldSchemaCount} documents with old schema fields`);
      console.log('You may need to migrate these documents or clear the collection');
      
      // Show sample of old documents
      const sampleOldDocs = await inventoryCollection.find({
        $or: [
          { itemcode: { $exists: true } },
          { cost: { $exists: true } },
          { price: { $exists: true } }
        ]
      }).limit(3).toArray();
      
      console.log('Sample old documents:');
      console.log(JSON.stringify(sampleOldDocs, null, 2));
    }
    
    console.log('\nUpdated indexes:');
    const updatedIndexes = await inventoryCollection.indexes();
    console.log(JSON.stringify(updatedIndexes, null, 2));
    
    console.log('\nDatabase cleanup complete!');
    console.log('You can now restart the server to apply the new schema changes.');
    console.log('The new indexes will be created automatically when the server starts.');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
})
.catch(err => {
  console.error('Error connecting to MongoDB:', err.message);
});
