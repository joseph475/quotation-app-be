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

const createTestUser = async () => {
  try {
    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    
    if (existingUser) {
      console.log('Test user already exists. Deleting and recreating...');
      await User.deleteOne({ email: 'test@example.com' });
    }
    
    // Create a new test user with a simple password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('test123', salt);
    
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      password: hashedPassword,
      branch: 'All'  // Admin users have access to all branches
    });
    
    await testUser.save();
    
    console.log('Test user created successfully:');
    console.log('Email: test@example.com');
    console.log('Password: test123');
    
    // Find the user again to verify it was saved correctly
    const savedUser = await User.findOne({ email: 'test@example.com' }).select('+password');
    console.log('\nVerifying saved user:');
    console.log('User ID:', savedUser._id);
    console.log('Name:', savedUser.name);
    console.log('Email:', savedUser.email);
    console.log('Role:', savedUser.role);
    console.log('Hashed Password:', savedUser.password);
    
    // Test password matching
    const isMatch = await bcrypt.compare('test123', savedUser.password);
    console.log('\nPassword match test:', isMatch ? 'SUCCESS' : 'FAILED');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating test user:', err);
    process.exit(1);
  }
};

createTestUser();
