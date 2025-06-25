const http = require('http');
const https = require('https');

// Test deployment endpoints
const testEndpoints = async (baseUrl) => {
  console.log(`Testing deployment at: ${baseUrl}`);
  console.log('=' .repeat(50));

  const makeRequest = (url) => {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  };

  const endpoints = [
    { name: 'Root', path: '/' },
    { name: 'Health Check', path: '/health' },
    { name: 'Ready Check', path: '/ready' },
    { name: 'Test Route', path: '/api/v1/test' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting ${endpoint.name} (${endpoint.path})...`);
      const response = await makeRequest(`${baseUrl}${endpoint.path}`);
      
      console.log(`Status: ${response.statusCode}`);
      
      if (response.statusCode === 200 || response.statusCode === 503) {
        try {
          const jsonData = JSON.parse(response.body);
          console.log('Response:', JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('Response (text):', response.body.substring(0, 200));
        }
      } else {
        console.log('Response:', response.body.substring(0, 200));
      }
      
      console.log('✅ Request completed');
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
};

// Get URL from command line arguments or use default
const url = process.argv[2] || 'http://localhost:8000';

testEndpoints(url)
  .then(() => {
    console.log('\n' + '=' .repeat(50));
    console.log('Deployment test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
