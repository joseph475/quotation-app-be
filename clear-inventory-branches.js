const mongoose = require('mongoose');
require('dotenv').config();

// Load models
const Inventory = require('./models/Inventory');
const Branch = require('./models/Branch');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB Connected...');
  
  try {
    // Clear inventory and branches data
    await Inventory.deleteMany();
    console.log('Inventory collection cleared');
    
    await Branch.deleteMany();
    console.log('Branches collection cleared');
    
    console.log('Collections cleared successfully!');
    console.log('You can now test creating inventory items and branches in the app.');
    
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
