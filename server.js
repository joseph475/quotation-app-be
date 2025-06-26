// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const webSocketService = require('./utils/websocketService');
const { testConnection } = require('./config/supabase');

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Middleware - Configure CORS for mobile access
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8080',
      'https://quotation-app-fe.onrender.com',
      'https://quotation-app-fe.vercel.app',
      'https://railway.com'
    ];

console.log('CORS Configuration:');
console.log('Allowed origins:', allowedOrigins);
console.log('Environment ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check for origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin - allowing request');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('CORS BLOCKED - Origin not allowed:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Connect to Supabase
let dbConnected = false;

// Test Supabase connection
testConnection()
  .then(() => {
    dbConnected = true;
    console.log('Supabase connection established');
  })
  .catch((error) => {
    console.error('Supabase connection failed:', error);
    console.error('Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
  });

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/devices', require('./routes/deviceFingerprint'));
app.use('/api/v1/test', require('./routes/test'));
app.use('/api/v1/inventory', require('./routes/inventory'));
app.use('/api/v1/quotations', require('./routes/quotations'));
app.use('/api/v1/sales', require('./routes/sales'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
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
  const dbStatus = dbConnected ? 'connected' : 'disconnected';
  const isHealthy = dbConnected;
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    database: dbStatus,
    databaseType: 'Supabase',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  const isReady = dbConnected;
  
  res.status(isReady ? 200 : 503).json({
    success: isReady,
    status: isReady ? 'ready' : 'not ready',
    database: dbConnected ? 'connected' : 'disconnected',
    databaseType: 'Supabase',
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

// Start server (for deployment platforms)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000;
  console.log(`Starting server...`);
  console.log(`Environment PORT: ${process.env.PORT}`);
  console.log(`Using PORT: ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`VERCEL: ${process.env.VERCEL}`);
  
  server.listen(PORT, '0.0.0.0', (err) => {
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
  
  // Handle graceful shutdown
  let isShuttingDown = false;
  
  const gracefulShutdown = async (signal) => {
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
    
    try {
      // Close HTTP server
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error('Error closing HTTP server:', err);
            reject(err);
          } else {
            console.log('HTTP server closed');
            resolve();
          }
        });
      });
      
      // Supabase connections are stateless, no need to close
      console.log('Supabase connections are stateless - no cleanup needed');
      
      clearTimeout(shutdownTimeout);
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
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
