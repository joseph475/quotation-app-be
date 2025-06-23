// Vercel serverless function entry point
const connectDB = require('../config/database');
const app = require('../server');

// Connect to database once when the function starts
connectDB().catch(console.error);

// Export the Express app directly
module.exports = app;
