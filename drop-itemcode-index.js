const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB Connected...');
  
  try {
    // Get the Inventory collection
    const db = mongoose.connection.db;
    const inventoryCollection = db.collection('inventories');
    
    // List all indexes
    console.log('Current indexes:');
    const indexes = await inventoryCollection.indexes();
    console.log(indexes);
    
    // Find and drop the itemCode_1 index
    for (const index of indexes) {
      if (index.key && index.key.itemCode === 1 && Object.keys(index.key).length === 1) {
        console.log('Found itemCode_1 index, dropping it...');
        await inventoryCollection.dropIndex(index.name);
        console.log('Index dropped successfully');
      }
    }
    
    console.log('Updated indexes:');
    const updatedIndexes = await inventoryCollection.indexes();
    console.log(updatedIndexes);
    
    console.log('Done. You can now restart the server to apply the new schema changes.');
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
