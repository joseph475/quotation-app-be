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

const fixItemCodeIssues = async () => {
  try {
    console.log('Starting itemCode fix process...');
    
    // 1. First, let's see what we're dealing with
    const totalItems = await Inventory.countDocuments();
    console.log(`Total inventory items: ${totalItems}`);
    
    const itemsWithNullItemCode = await Inventory.countDocuments({ itemcode: null });
    console.log(`Items with null itemcode: ${itemsWithNullItemCode}`);
    
    const itemsWithUndefinedItemCode = await Inventory.countDocuments({ itemcode: { $exists: false } });
    console.log(`Items with undefined itemcode: ${itemsWithUndefinedItemCode}`);
    
    // 2. Find items with null or undefined itemcode
    const problematicItems = await Inventory.find({
      $or: [
        { itemcode: null },
        { itemcode: { $exists: false } }
      ]
    }).sort({ createdAt: 1 }); // Sort by creation date to maintain some order
    
    console.log(`Found ${problematicItems.length} items with problematic itemcodes`);
    
    if (problematicItems.length === 0) {
      console.log('No problematic items found. Checking for duplicate itemcodes...');
      
      // Check for duplicate itemcodes
      const duplicates = await Inventory.aggregate([
        { $group: { _id: '$itemcode', count: { $sum: 1 }, docs: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
      ]);
      
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicate itemcode groups:`);
        duplicates.forEach(dup => {
          console.log(`ItemCode ${dup._id}: ${dup.count} duplicates`);
        });
      } else {
        console.log('No duplicate itemcodes found.');
      }
      
      return;
    }
    
    // 3. Find the highest existing itemcode
    const highestItem = await Inventory.findOne(
      { itemcode: { $ne: null, $exists: true } },
      {},
      { sort: { itemcode: -1 } }
    );
    
    let nextItemCode = highestItem ? highestItem.itemcode + 1 : 1;
    console.log(`Starting itemcode assignment from: ${nextItemCode}`);
    
    // 4. Fix items one by one to avoid conflicts
    let fixed = 0;
    for (const item of problematicItems) {
      try {
        // Update the item with a new itemcode
        await Inventory.findByIdAndUpdate(
          item._id,
          { itemcode: nextItemCode },
          { new: true, runValidators: true }
        );
        
        console.log(`Fixed item ${item._id}: assigned itemcode ${nextItemCode}`);
        nextItemCode++;
        fixed++;
      } catch (error) {
        console.error(`Error fixing item ${item._id}:`, error.message);
      }
    }
    
    console.log(`Successfully fixed ${fixed} items`);
    
    // 5. Verify the fix
    const remainingProblematic = await Inventory.countDocuments({
      $or: [
        { itemcode: null },
        { itemcode: { $exists: false } }
      ]
    });
    
    console.log(`Remaining problematic items: ${remainingProblematic}`);
    
    // 6. Check for any remaining duplicates
    const finalDuplicates = await Inventory.aggregate([
      { $group: { _id: '$itemcode', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (finalDuplicates.length > 0) {
      console.log(`Warning: Still have ${finalDuplicates.length} duplicate itemcode groups:`);
      finalDuplicates.forEach(dup => {
        console.log(`ItemCode ${dup._id}: ${dup.count} duplicates`);
      });
    } else {
      console.log('✅ No duplicate itemcodes remaining.');
    }
    
    console.log('ItemCode fix process completed!');
    
  } catch (error) {
    console.error('Error during fix process:', error);
  }
};

const main = async () => {
  await connectDB();
  await fixItemCodeIssues();
  await mongoose.connection.close();
  console.log('Database connection closed.');
};

main().catch(console.error);
