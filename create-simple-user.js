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

const createSimpleUser = async () => {
  try {
    // Check if simple user already exists
    const existingUser = await User.findOne({ email: 'simple@example.com' });
    
    if (existingUser) {
      console.log('Simple user already exists. Deleting and recreating...');
      await User.deleteOne({ email: 'simple@example.com' });
    }
    
    // Create a new simple user with a very simple password
    // Skip the pre-save hook by using insertOne directly
    const simpleUser = {
      name: 'Simple User',
      email: 'simple@example.com',
      role: 'admin',
      password: await bcrypt.hash('123', 10),
      branch: 'All',  // Admin users have access to all branches
      createdAt: new Date()
    };
    
    const result = await User.collection.insertOne(simpleUser);
    console.log('Simple user created successfully with _id:', result.insertedId);
    console.log('Email: simple@example.com');
    console.log('Password: 123');
    
    // Find the user again to verify it was saved correctly
    const savedUser = await User.findOne({ email: 'simple@example.com' }).select('+password');
    console.log('\nVerifying saved user:');
    console.log('User ID:', savedUser._id);
    console.log('Name:', savedUser.name);
    console.log('Email:', savedUser.email);
    console.log('Role:', savedUser.role);
    console.log('Hashed Password:', savedUser.password);
    
    // Test password matching
    const isMatch = await bcrypt.compare('123', savedUser.password);
    console.log('\nPassword match test:', isMatch ? 'SUCCESS' : 'FAILED');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating simple user:', err);
    process.exit(1);
  }
};

createSimpleUser();
