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

const testCompleteFunctionality = async () => {
  try {
    console.log('=== Testing Complete Inventory Functionality ===\n');
    
    // 1. Create a test item manually (like frontend would do)
    const testItemData = {
      name: 'Manual Test Item ' + Date.now(),
      barcode: 'MANUAL' + Date.now(),
      unit: 'pcs',
      cost: 25.50,
      price: 35.00
    };
    
    console.log('1. Creating manual test item...');
    console.log('   Data:', testItemData);
    
    const createdItem = await Inventory.create(testItemData);
    console.log('   ✅ Created successfully!');
    console.log('   - ID:', createdItem._id);
    console.log('   - ItemCode:', createdItem.itemcode);
    console.log('   - Name:', createdItem.name);
    console.log('   - Barcode:', createdItem.barcode);
    
    // 2. Test search by name
    console.log('\n2. Testing search by name...');
    const nameQuery = createdItem.name.substring(0, 10);
    console.log('   Search query:', nameQuery);
    
    const nameSearchResults = await Inventory.find({
      $or: [
        { name: { $regex: nameQuery, $options: 'i' } },
        { itemcode: parseInt(nameQuery) || 0 },
        { 
          barcode: { 
            $regex: nameQuery, 
            $options: 'i',
            $ne: null
          } 
        }
      ]
    });
    
    console.log('   Results found:', nameSearchResults.length);
    const foundOurItem = nameSearchResults.some(item => item._id.toString() === createdItem._id.toString());
    console.log('   Our item found:', foundOurItem ? '✅ YES' : '❌ NO');
    
    // 3. Test search by barcode
    console.log('\n3. Testing search by barcode...');
    const barcodeQuery = createdItem.barcode.substring(0, 8);
    console.log('   Search query:', barcodeQuery);
    
    const barcodeSearchResults = await Inventory.find({
      $or: [
        { name: { $regex: barcodeQuery, $options: 'i' } },
        { itemcode: parseInt(barcodeQuery) || 0 },
        { 
          barcode: { 
            $regex: barcodeQuery, 
            $options: 'i',
            $ne: null
          } 
        }
      ]
    });
    
    console.log('   Results found:', barcodeSearchResults.length);
    const foundByBarcode = barcodeSearchResults.some(item => item._id.toString() === createdItem._id.toString());
    console.log('   Our item found:', foundByBarcode ? '✅ YES' : '❌ NO');
    
    // 4. Test search by itemcode
    console.log('\n4. Testing search by itemcode...');
    const itemcodeQuery = createdItem.itemcode.toString();
    console.log('   Search query:', itemcodeQuery);
    
    const itemcodeSearchResults = await Inventory.find({
      $or: [
        { name: { $regex: itemcodeQuery, $options: 'i' } },
        { itemcode: parseInt(itemcodeQuery) || 0 },
        { 
          barcode: { 
            $regex: itemcodeQuery, 
            $options: 'i',
            $ne: null
          } 
        }
      ]
    });
    
    console.log('   Results found:', itemcodeSearchResults.length);
    const foundByItemcode = itemcodeSearchResults.some(item => item._id.toString() === createdItem._id.toString());
    console.log('   Our item found:', foundByItemcode ? '✅ YES' : '❌ NO');
    
    // 5. Test the exact search function from controller
    console.log('\n5. Testing controller search function...');
    
    const testControllerSearch = async (query) => {
      const searchConditions = [
        { name: { $regex: query, $options: 'i' } },
        { itemcode: parseInt(query) || 0 }
      ];
      
      if (isNaN(parseInt(query))) {
        searchConditions.push({ 
          barcode: { 
            $regex: query, 
            $options: 'i',
            $ne: null
          } 
        });
      }
      
      const searchFilter = { $or: searchConditions };
      return await Inventory.find(searchFilter);
    };
    
    // Test with name
    const controllerNameResults = await testControllerSearch(nameQuery);
    console.log('   Name search results:', controllerNameResults.length);
    console.log('   Found our item:', controllerNameResults.some(item => item._id.toString() === createdItem._id.toString()) ? '✅ YES' : '❌ NO');
    
    // Test with barcode
    const controllerBarcodeResults = await testControllerSearch(barcodeQuery);
    console.log('   Barcode search results:', controllerBarcodeResults.length);
    console.log('   Found our item:', controllerBarcodeResults.some(item => item._id.toString() === createdItem._id.toString()) ? '✅ YES' : '❌ NO');
    
    // Test with itemcode
    const controllerItemcodeResults = await testControllerSearch(itemcodeQuery);
    console.log('   ItemCode search results:', controllerItemcodeResults.length);
    console.log('   Found our item:', controllerItemcodeResults.some(item => item._id.toString() === createdItem._id.toString()) ? '✅ YES' : '❌ NO');
    
    // 6. Check if there are any issues with the item
    console.log('\n6. Verifying item details...');
    const verifyItem = await Inventory.findById(createdItem._id);
    console.log('   Item exists in DB:', verifyItem ? '✅ YES' : '❌ NO');
    if (verifyItem) {
      console.log('   - ItemCode:', verifyItem.itemcode, typeof verifyItem.itemcode);
      console.log('   - Name:', verifyItem.name, typeof verifyItem.name);
      console.log('   - Barcode:', verifyItem.barcode, typeof verifyItem.barcode);
      console.log('   - Unit:', verifyItem.unit);
      console.log('   - Cost:', verifyItem.cost);
      console.log('   - Price:', verifyItem.price);
      console.log('   - Created:', verifyItem.createdAt);
    }
    
    // 7. Clean up - delete the test item
    console.log('\n7. Cleaning up...');
    await Inventory.findByIdAndDelete(createdItem._id);
    console.log('   ✅ Test item deleted');
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Manual item creation: WORKING');
    console.log(foundOurItem ? '✅' : '❌', 'Name search: ' + (foundOurItem ? 'WORKING' : 'FAILED'));
    console.log(foundByBarcode ? '✅' : '❌', 'Barcode search: ' + (foundByBarcode ? 'WORKING' : 'FAILED'));
    console.log(foundByItemcode ? '✅' : '❌', 'ItemCode search: ' + (foundByItemcode ? 'WORKING' : 'FAILED'));
    
    console.log('\n🎉 Complete functionality test finished!');
    
  } catch (error) {
    console.error('❌ Error during complete functionality test:', error.message);
    console.error('Stack:', error.stack);
  }
};

const main = async () => {
  await connectDB();
  await testCompleteFunctionality();
  await mongoose.connection.close();
  console.log('Database connection closed.');
};

main().catch(console.error);
