const axios = require('axios');

// Define the API endpoint
const API_URL = 'http://localhost:8000/api/v1/auth/login';

// Test credentials
const credentials = {
  email: 'admin@example.com',
  password: 'password123'
};

// Function to test login
async function testLogin() {
  try {
    console.log('Testing login with credentials:');
    console.log('Email:', credentials.email);
    console.log('Password:', credentials.password);
    
    const response = await axios.post(API_URL, credentials);
    
    console.log('\nLogin successful!');
    console.log('Response status:', response.status);
    console.log('User details:');
    console.log('- Name:', response.data.user.name);
    console.log('- Email:', response.data.user.email);
    console.log('- Role:', response.data.user.role);
    console.log('- Token received:', response.data.token ? 'Yes' : 'No');
    
    return true;
  } catch (error) {
    console.error('\nLogin failed!');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response status:', error.response.status);
      console.error('Error message:', error.response.data.message);
      console.error('Full response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server. Is the server running?');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    
    return false;
  }
}

// Execute the test
testLogin()
  .then(success => {
    if (success) {
      console.log('\nLogin test completed successfully!');
    } else {
      console.log('\nLogin test failed. Please check the error messages above.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error during test execution:', err);
    process.exit(1);
  });
