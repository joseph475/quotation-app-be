/**
 * Deployment Verification Script
 * Run this script to verify your Vercel deployment is working correctly
 * 
 * Usage: node verify-deployment.js <your-vercel-url>
 * Example: node verify-deployment.js https://your-app.vercel.app
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.argv[2];

if (!BASE_URL) {
  console.error('❌ Please provide your Vercel deployment URL');
  console.log('Usage: node verify-deployment.js <your-vercel-url>');
  console.log('Example: node verify-deployment.js https://your-app.vercel.app');
  process.exit(1);
}

console.log(`🚀 Verifying deployment at: ${BASE_URL}`);
console.log('=' .repeat(50));

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Test endpoints
const tests = [
  {
    name: 'Root Endpoint',
    url: BASE_URL,
    expectedStatus: 200
  },
  {
    name: 'Health Check',
    url: `${BASE_URL}/health`,
    expectedStatus: 200
  },
  {
    name: 'API Base (should return 404)',
    url: `${BASE_URL}/api/v1`,
    expectedStatus: 404
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 Testing: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const result = await makeRequest(test.url);
      
      if (result.status === test.expectedStatus) {
        console.log(`   ✅ Status: ${result.status} (Expected: ${test.expectedStatus})`);
        
        if (typeof result.data === 'object') {
          console.log(`   📄 Response:`, JSON.stringify(result.data, null, 2));
        }
        
        passed++;
      } else {
        console.log(`   ❌ Status: ${result.status} (Expected: ${test.expectedStatus})`);
        failed++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Your deployment is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Test your API endpoints with a tool like Postman');
    console.log('   2. Verify database connectivity by testing auth endpoints');
    console.log('   3. Monitor your Vercel dashboard for any errors');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your deployment configuration.');
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check Vercel deployment logs');
    console.log('   2. Verify environment variables are set correctly');
    console.log('   3. Ensure MongoDB Atlas allows Vercel connections');
  }
}

runTests().catch(console.error);
