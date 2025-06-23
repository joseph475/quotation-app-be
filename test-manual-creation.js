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

const testManualCreation = async () => {
  try {
    console.log('Testing manual inventory item creation...');
    
    // Test creating a new item without specifying itemcode
    const testItem = {
      name: 'Test Item ' + Date.now(),
      barcode: 'TEST' + Date.now(),
      unit: 'pcs',
      cost: 10.50,
      price: 15.00
    };
    
    console.log('Creating item with data:', testItem);
    
    const createdItem = await Inventory.create(testItem);
    
    console.log('✅ Successfully created item:');
    console.log('- ID:', createdItem._id);
    console.log('- ItemCode:', createdItem.itemcode);
    console.log('- Name:', createdItem.name);
    console.log('- Barcode:', createdItem.barcode);
    
    // Test getting next itemcode
    const nextItemCode = await Inventory.getNextItemCode();
    console.log('- Next ItemCode would be:', nextItemCode);
    
    // Verify the item was saved correctly
    const foundItem = await Inventory.findById(createdItem._id);
    console.log('✅ Item found in database with itemcode:', foundItem.itemcode);
    
    // Clean up - delete the test item
    await Inventory.findByIdAndDelete(createdItem._id);
    console.log('✅ Test item cleaned up');
    
    console.log('Manual creation test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during manual creation test:', error.message);
  }
};

const main = async () => {
  await connectDB();
  await testManualCreation();
  await mongoose.connection.close();
  console.log('Database connection closed.');
};

main().catch(console.error);
