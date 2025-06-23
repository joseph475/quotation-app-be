// Vercel serverless function entry point
const connectDB = require('../config/database');
const app = require('../server');

module.exports = async (req, res) => {
  try {
    // Connect to database before handling request
    await connectDB();
    
    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
};
