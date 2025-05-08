const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

console.log('Environment variables loaded:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE);

// Load User model
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const createNormalUser = async () => {
  try {
    // Check if normal user already exists
    const existingUser = await User.findOne({ email: 'normal@example.com' });
    
    if (existingUser) {
      console.log('Normal user already exists. Deleting and recreating...');
      await User.deleteOne({ email: 'normal@example.com' });
    }
    
    // Create a new normal user with a regular password
    const normalUser = new User({
      name: 'Normal User',
      email: 'normal@example.com',
      role: 'admin',
      password: 'Password123!',
      branch: 'All'  // Admin users have access to all branches
    });
    
    await normalUser.save();
    
    console.log('Normal user created successfully:');
    console.log('Email: normal@example.com');
    console.log('Password: Password123!');
    
    // Find the user again to verify it was saved correctly
    const savedUser = await User.findOne({ email: 'normal@example.com' }).select('+password');
    console.log('\nVerifying saved user:');
    console.log('User ID:', savedUser._id);
    console.log('Name:', savedUser.name);
    console.log('Email:', savedUser.email);
    console.log('Role:', savedUser.role);
    console.log('Hashed Password:', savedUser.password);
    
    // Test password matching
    const isMatch = await bcrypt.compare('Password123!', savedUser.password);
    console.log('\nPassword match test:', isMatch ? 'SUCCESS' : 'FAILED');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating normal user:', err);
    process.exit(1);
  }
};

createNormalUser();
