const app = require('../server');

// For serverless functions, we need to ensure DB connection on each request
module.exports = async (req, res) => {
  try {
    // The connectDB function in server.js will handle connection reuse
    return app(req, res);
  } catch (error) {
    console.error('API handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server initialization error'
    });
  }
};
