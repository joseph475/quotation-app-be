require('dotenv').config();
const mongoose = require('mongoose');
const PurchaseOrder = require('./models/PurchaseOrder');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

// Function to list all purchase orders
const listPurchaseOrders = async () => {
  try {
    // Find all purchase orders
    const purchaseOrders = await PurchaseOrder.find().select('orderNumber status');
    
    if (purchaseOrders.length === 0) {
      console.log('No purchase orders found in the database.');
    } else {
      console.log(`Found ${purchaseOrders.length} purchase orders:`);
      purchaseOrders.forEach(po => {
        console.log(`- ${po.orderNumber}: ${po.status}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Run the function
listPurchaseOrders();
