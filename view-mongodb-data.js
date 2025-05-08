const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app';

async function viewMongoDBData() {
  console.log('Connecting to MongoDB to view data...');
  console.log(`Connection URI: ${uri}`);
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('Connected to MongoDB server');
    
    // Get the database
    const db = client.db();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== MongoDB Database Content ===');
    console.log(`Database: ${db.databaseName}`);
    console.log(`Number of collections: ${collections.length}`);
    
    // Display data from each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      const documents = await db.collection(collectionName).find({}).toArray();
      
      console.log(`\n--- Collection: ${collectionName} (${documents.length} documents) ---`);
      
      if (documents.length > 0) {
        // Display a sample of documents (up to 3)
        const sampleSize = Math.min(3, documents.length);
        console.log(`Showing ${sampleSize} sample documents:`);
        
        for (let i = 0; i < sampleSize; i++) {
          console.log(`\nDocument ${i + 1}:`);
          console.log(JSON.stringify(documents[i], null, 2));
        }
        
        if (documents.length > sampleSize) {
          console.log(`\n... and ${documents.length - sampleSize} more documents`);
        }
      } else {
        console.log('No documents found in this collection');
      }
    }
    
    console.log('\n=== Ways to View MongoDB Data ===');
    console.log('1. MongoDB Shell:');
    console.log('   - Run "mongosh" in your terminal');
    console.log('   - Then use commands like:');
    console.log('     > show dbs');
    console.log('     > use quotation-app');
    console.log('     > show collections');
    console.log('     > db.users.find()');
    
    console.log('\n2. MongoDB Compass (GUI Tool):');
    console.log('   - Download from: https://www.mongodb.com/products/compass');
    console.log('   - Connect using: mongodb://localhost:27017/quotation-app');
    
    console.log('\n3. MongoDB Express (Web Interface):');
    console.log('   - Install: npm install -g mongo-express');
    console.log('   - Configure and run: mongo-express -u "" -p "" -d quotation-app');
    console.log('   - Access at: http://localhost:8081');
    
    console.log('\n4. Docker MongoDB Express:');
    console.log('   - Run: docker run -it --rm -p 8081:8081 --network=host mongo-express');
    console.log('   - Access at: http://localhost:8081');
    
  } catch (err) {
    console.error('Error viewing MongoDB data:', err);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the function
viewMongoDBData().catch(console.error);
