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
    
    // List databases
    const databasesList = await adminDb.listDatabases();
    console.log('\nAvailable databases:');
    databasesList.databases.forEach(db => {
      console.log(` - ${db.name}`);
    });
    
    console.log('\nYour MongoDB setup is working correctly.');
    console.log('You can now run the backend server with: npm run dev');
    
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
    
  } finally {
    // Close the connection
    await client.close();
  }
}

// Run the check
checkMongoDBConnection().catch(console.error);
