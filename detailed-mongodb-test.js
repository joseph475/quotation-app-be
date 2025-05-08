const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app';

async function testMongoDBConnection() {
  console.log('Testing MongoDB connection...');
  console.log(`Attempting to connect to: ${uri}`);
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // 5 second timeout
  });

  try {
    // Connect to the MongoDB server
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB server');
    
    // Check if we can get the server info
    console.log('Getting server info...');
    const adminDb = client.db().admin();
    const serverInfo = await adminDb.serverInfo();
    
    console.log('\n✅ MongoDB connection successful!');
    console.log(`MongoDB version: ${serverInfo.version}`);
    
    // List databases
    console.log('\nGetting database list...');
    const databasesList = await adminDb.listDatabases();
    console.log('Available databases:');
    databasesList.databases.forEach(db => {
      console.log(` - ${db.name}`);
    });
    
    console.log('\nYour MongoDB setup is working correctly.');
    
  } catch (err) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error details:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    
    // Provide troubleshooting tips
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure MongoDB is installed and running:');
    console.log('   - Check if Docker container is running: docker ps | grep mongo');
    console.log('   - Check Docker container logs: docker logs mongodb');
    console.log('2. Verify your connection string in the .env file is correct.');
    console.log('3. Make sure port 27017 is accessible:');
    console.log('   - Try connecting with MongoDB Compass or another client');
    console.log('   - Check if the port is exposed correctly in Docker');
    
  } finally {
    // Close the connection
    console.log('Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the test
testMongoDBConnection().catch(err => {
  console.error('Unexpected error:', err);
});
