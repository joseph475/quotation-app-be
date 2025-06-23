const connectDB = require('../config/database');
const app = require('../server');

// Initialize database connection
let dbConnected = false;

const handler = async (req, res) => {
  try {
    // Connect to database if not already connected
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
    }
    
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

module.exports = handler;
