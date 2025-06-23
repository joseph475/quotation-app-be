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

// Import the Inventory model
const Inventory = require('./models/Inventory');

const testSearchFunctionality = async () => {
  try {
    console.log('Testing search functionality...');
    
    // 1. First, let's see all items in the database
    const allItems = await Inventory.find({}).limit(10);
    console.log('\n=== All Items (first 10) ===');
    allItems.forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item._id}`);
      console.log(`   ItemCode: ${item.itemcode}`);
      console.log(`   Name: ${item.name}`);
      console.log(`   Barcode: ${item.barcode || 'null'}`);
      console.log(`   Unit: ${item.unit}`);
      console.log('   ---');
    });
    
    if (allItems.length === 0) {
      console.log('No items found in database!');
      return;
    }
    
    // 2. Test search by name
    const testItem = allItems[0];
    console.log(`\n=== Testing Search with Item: ${testItem.name} ===`);
    
    // Test exact name search
    const nameSearch = await Inventory.find({
      name: { $regex: testItem.name, $options: 'i' }
    });
    console.log(`Name search results: ${nameSearch.length} items found`);
    
    // Test partial name search
    const partialName = testItem.name.substring(0, 3);
    const partialNameSearch = await Inventory.find({
      name: { $regex: partialName, $options: 'i' }
    });
    console.log(`Partial name search (${partialName}): ${partialNameSearch.length} items found`);
    
    // 3. Test search by itemcode
    const itemcodeSearch = await Inventory.find({
      itemcode: testItem.itemcode
    });
    console.log(`ItemCode search (${testItem.itemcode}): ${itemcodeSearch.length} items found`);
    
    // 4. Test search by barcode (if exists)
    if (testItem.barcode) {
      const barcodeSearch = await Inventory.find({
        barcode: { $regex: testItem.barcode, $options: 'i' }
      });
      console.log(`Barcode search (${testItem.barcode}): ${barcodeSearch.length} items found`);
    } else {
      console.log('Test item has no barcode, skipping barcode search');
    }
    
    // 5. Test the full search filter (like in the controller)
    const searchQuery = testItem.name.substring(0, 5);
    console.log(`\n=== Testing Full Search Filter with query: "${searchQuery}" ===`);
    
    const searchFilter = {
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { barcode: { $regex: searchQuery, $options: 'i' } },
        { itemcode: parseInt(searchQuery) || 0 }
      ]
    };
    
    const fullSearchResults = await Inventory.find(searchFilter);
    console.log(`Full search results: ${fullSearchResults.length} items found`);
    
    if (fullSearchResults.length > 0) {
      console.log('Found items:');
      fullSearchResults.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (ItemCode: ${item.itemcode}, Barcode: ${item.barcode || 'null'})`);
      });
    }
    
    // 6. Test with a manually created item if we can find one
    console.log('\n=== Looking for recently created items ===');
    const recentItems = await Inventory.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('Most recent 5 items:');
    recentItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} (Created: ${item.createdAt}, ItemCode: ${item.itemcode})`);
    });
    
    // 7. Check indexes
    console.log('\n=== Checking Database Indexes ===');
    const db = mongoose.connection.db;
    const collection = db.collection('inventories');
    const indexes = await collection.indexes();
    console.log('Current indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}:`, index.key);
    });
    
    console.log('\nSearch functionality test completed!');
    
  } catch (error) {
    console.error('❌ Error during search test:', error.message);
  }
};

const main = async () => {
  await connectDB();
  await testSearchFunctionality();
  await mongoose.connection.close();
  console.log('Database connection closed.');
};

main().catch(console.error);
