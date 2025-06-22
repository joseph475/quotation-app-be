const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/inventory', require('./routes/inventory'));
app.use('/api/v1/customers', require('./routes/customers'));
app.use('/api/v1/quotations', require('./routes/quotations'));
app.use('/api/v1/sales', require('./routes/sales'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/suppliers', require('./routes/suppliers'));
app.use('/api/v1/supplier-prices', require('./routes/supplierPrices'));
app.use('/api/v1/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/v1/purchase-receiving', require('./routes/purchaseReceiving'));
app.use('/api/v1/stock-transfers', require('./routes/stockTransfers'));
app.use('/api/v1/branches', require('./routes/branches'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/reports', require('./routes/reports'));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Quotation App API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('ERROR OCCURRED:');
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request body:', req.body);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  console.error('Request query:', req.query);
  console.error('Request params:', req.params);
  
  res.status(500).json({
    success: false,
    message: 'Server error: ' + err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Export the app for Vercel
module.exports = app;

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
