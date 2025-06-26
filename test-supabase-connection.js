const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 Testing Supabase Connection...');
console.log('================================');

// Show what we're using (without exposing the full keys)
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 
  `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'NOT SET');

// Test the connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  try {
    console.log('\n🧪 Testing connection...');
    
    // Try a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('💡 Hint:', error.hint || 'Check your API keys');
      
      if (error.message.includes('Invalid API key')) {
        console.log('\n🔑 Your Service Role Key is invalid or placeholder!');
        console.log('📍 Get the real key from: https://supabase.com/dashboard');
        console.log('   → Settings → API → Service Role Key');
        console.log('   → Copy the FULL key (it\'s very long)');
        console.log('   → Update ../quotation-app-be/.env');
      }
    } else {
      console.log('✅ Connection successful!');
      console.log('📊 Data:', data);
    }
  } catch (err) {
    console.error('💥 Unexpected error:', err.message);
  }
}

testConnection();
