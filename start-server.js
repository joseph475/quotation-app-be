const { spawn } = require('child_process');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app';

async function checkMongoDBConnection() {
  console.log('Checking MongoDB connection...');
  console.log(`Attempting to connect to: ${uri}`);
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // 5 second timeout
  });

  try {
    // Connect to the MongoDB server
    await client.connect();
    
    // Check if we can get the server info
    const adminDb = client.db().admin();
    const serverInfo = await adminDb.serverInfo();
    
    console.log('\n✅ MongoDB connection successful!');
    console.log(`MongoDB version: ${serverInfo.version}`);
    
    // Close the connection
    await client.close();
    
    return true;
  } catch (err) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error details:', err.message);
    
    // Provide troubleshooting tips
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure MongoDB is installed and running on your system.');
    console.log('   - On Windows: Check if MongoDB service is running');
    console.log('   - On macOS: Run "brew services list" to check MongoDB status');
    console.log('   - On Linux: Run "sudo systemctl status mongod" to check MongoDB status');
    console.log('2. Verify your connection string in the .env file is correct.');
    console.log('3. If using MongoDB Atlas, check your network settings and whitelist your IP.');
    console.log('4. Ensure your MongoDB user has the correct permissions.');
    
    // Close the connection
    await client.close();
    
    return false;
  }
}

function startServer() {
  console.log('\nStarting the backend server...');
  
  // Determine which script to run based on NODE_ENV
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptName = isDev ? 'dev' : 'start';
  
  // Use npm to run the script
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(npm, ['run', scriptName], { stdio: 'inherit' });
  
  server.on('close', (code) => {
    if (code !== 0) {
      console.log(`Server process exited with code ${code}`);
    }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    server.kill('SIGINT');
    process.exit(0);
  });
}

// Main function
async function main() {
  console.log('=== Quotation App Backend Startup ===\n');
  
  const isConnected = await checkMongoDBConnection();
  
  if (isConnected) {
    console.log('\nMongoDB connection verified. Starting server...');
    startServer();
  } else {
    console.log('\nFailed to connect to MongoDB. Please fix the connection issues before starting the server.');
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
