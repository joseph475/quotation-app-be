const { MongoClient } = require('mongodb');

// MongoDB connection URI
const uri = 'mongodb://localhost:27017/quotation-app';

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
    
  } catch (err) {
    console.error('\n❌ MongoDB connection failed!');
    console.error('Error details:', err.message);
    
  } finally {
    // Close the connection
    await client.close();
  }
}

// Run the test
testMongoDBConnection().catch(console.error);
