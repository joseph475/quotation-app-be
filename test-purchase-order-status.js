const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Load models
const PurchaseOrder = require('./models/PurchaseOrder');
const Supplier = require('./models/Supplier');
const Inventory = require('./models/Inventory');
const User = require('./models/User');
const Branch = require('./models/Branch');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Log connection status
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

const testPurchaseOrderStatus = async () => {
  try {
    console.log('Starting test...');
    
    // Find a purchase order with status 'Partial'
    console.log('Searching for purchase orders with status "Partial"...');
    const partialOrders = await PurchaseOrder.find({ status: 'Partial' });
    console.log(`Found ${partialOrders.length} purchase orders with status 'Partial'`);
    
    if (partialOrders.length > 0) {
      console.log('First partial order details:');
      console.log(`Order Number: ${partialOrders[0].orderNumber}`);
      console.log(`Status: ${partialOrders[0].status}`);
      console.log(`Items: ${partialOrders[0].items.length}`);
      
      // Check received quantities
      partialOrders[0].items.forEach((item, index) => {
        console.log(`Item ${index + 1}: ${item.name}`);
        console.log(`  Quantity: ${item.quantity}`);
        console.log(`  Received: ${item.receivedQuantity}`);
      });
    }

    // Get all purchase orders to check their statuses
    console.log('\nFetching all purchase orders...');
    const allOrders = await PurchaseOrder.find();
    console.log(`Found ${allOrders.length} total purchase orders`);
    
    if (allOrders.length > 0) {
      console.log('\nAll purchase order statuses:');
      allOrders.forEach(order => {
        console.log(`${order.orderNumber}: ${order.status}`);
      });
    } else {
      console.log('No purchase orders found in the database');
    }

    console.log('\nTest completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error in testPurchaseOrderStatus:');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

testPurchaseOrderStatus();
