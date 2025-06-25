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

// Connect to database and wait for connection
let dbConnected = false;
connectDB()
  .then(() => {
    dbConnected = true;
    console.log('Database connection established');
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

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
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const isHealthy = dbConnected && mongoose.connection.readyState === 1;
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  const isReady = dbConnected && mongoose.connection.readyState === 1;
  
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? 'ready' : 'not ready',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
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
  console.log(`Starting server...`);
  console.log(`Environment PORT: ${process.env.PORT}`);
  console.log(`Using PORT: ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`VERCEL: ${process.env.VERCEL}`);
  
  server.listen(PORT, (err) => {
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log(`Server running on port ${PORT}`);
    console.log(`Server accessible at:`);
    console.log(`  - Local: http://localhost:${PORT}`);
    console.log(`  - Network: http://0.0.0.0:${PORT}`);
    console.log(`WebSocket server available at:`);
    console.log(`  - Local: ws://localhost:${PORT}/ws`);
    console.log(`  - Network: ws://0.0.0.0:${PORT}/ws`);
    console.log('Server started successfully - keeping alive');
  });
  
  // Handle graceful shutdown for Railway
  let isShuttingDown = false;
  
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) {
      console.log(`${signal} received again, forcing exit`);
      process.exit(1);
    }
    
    isShuttingDown = true;
    console.log(`${signal} received - shutting down gracefully`);
    
    // Set a timeout to force exit if graceful shutdown takes too long
    const shutdownTimeout = setTimeout(() => {
      console.log('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 10000); // 10 seconds timeout
    
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed');
      }
      
      mongoose.connection.close(false, (err) => {
        if (err) {
          console.error('Error closing MongoDB connection:', err);
        } else {
          console.log('MongoDB connection closed');
        }
        
        clearTimeout(shutdownTimeout);
        console.log('Graceful shutdown completed');
        process.exit(0);
      });
    });
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}
