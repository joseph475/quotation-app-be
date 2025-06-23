const mongoose = require('mongoose');

// Disable buffering globally to prevent timeout errors
mongoose.set('bufferCommands', false);
mongoose.set('bufferMaxEntries', 0);

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased to 10s
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1, // Reduced minimum connections
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      connectTimeoutMS: 10000, // Connection timeout
    });

    isConnected = conn.connections[0].readyState === 1;
    console.log('MongoDB connected successfully, readyState:', conn.connections[0].readyState);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnected = false;
    throw error;
  }
};

module.exports = connectDB;
