const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Load Branch model
const Branch = require('./models/Branch');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const checkBranches = async () => {
  try {
    console.log('Checking branches in the database...');
    
    // Get all branches
    const branches = await Branch.find();
    
    console.log(`Found ${branches.length} branches:`);
    
    if (branches.length > 0) {
      branches.forEach((branch, index) => {
        console.log(`\nBranch ${index + 1}:`);
        console.log(`ID: ${branch._id}`);
        console.log(`Name: ${branch.name}`);
        console.log(`Address: ${branch.address}`);
        console.log(`Contact Number: ${branch.contactNumber}`);
        console.log(`Manager: ${branch.manager}`);
        console.log(`Email: ${branch.email}`);
        console.log(`Active: ${branch.isActive}`);
      });
    } else {
      console.log('No branches found in the database.');
      console.log('You may need to run the seeder script: node seeder.js -i');
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error checking branches:', err);
    mongoose.connection.close();
    process.exit(1);
  }
};

checkBranches();
