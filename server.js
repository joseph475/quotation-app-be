const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const webSocketService = require('./utils/websocketService');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Middleware - Configure CORS for mobile access
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Connect to MongoDB for local development
const connectDB = require('./config/database');

// Connect to database
connectDB().catch(console.error);

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/devices', require('./routes/deviceFingerprint'));
app.use('/api/v1/test', require('./routes/test'));
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
app.use('/api/v1/inventory-history', require('./routes/inventoryHistory'));
app.use('/api/v1/cost-history', require('./routes/costHistory'));

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

// Initialize WebSocket service
webSocketService.initialize(server);

// Export the app for Vercel
module.exports = app;

// Start server (Railway and other platforms)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  console.log(`Environment PORT: ${process.env.PORT}`);
  console.log(`Using PORT: ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`VERCEL: ${process.env.VERCEL}`);
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server accessible at:`);
    console.log(`  - Local: http://localhost:${PORT}`);
    console.log(`  - Network: http://0.0.0.0:${PORT}`);
    console.log(`WebSocket server available at:`);
    console.log(`  - Local: ws://localhost:${PORT}/ws`);
    console.log(`  - Network: ws://0.0.0.0:${PORT}/ws`);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
}
