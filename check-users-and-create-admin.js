require('dotenv').config();
const { supabase } = require('./config/supabase');
const bcrypt = require('bcryptjs');

async function checkAndCreateUsers() {
  try {
    console.log('Checking existing users in Supabase...');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('Error querying users:', usersError);
      return;
    }
    
    console.log(`Found ${users?.length || 0} users:`);
    if (users && users.length > 0) {
      users.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - Active: ${user.is_active}`);
      });
    }
    
    // Create common admin user if it doesn't exist
    const adminEmail = 'admin@example.com';
    const adminExists = users?.find(u => u.email === adminEmail);
    
    if (!adminExists) {
      console.log('\nCreating admin@example.com user...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const { data: adminUser, error: createError } = await supabase
        .from('users')
        .insert([{
          name: 'Admin User',
          email: adminEmail,
          password_hash: hashedPassword,
          role: 'admin',
          is_active: true,
          phone: null,
          department: null,
          address: null
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating admin user:', createError);
      } else {
        console.log('Admin user created successfully!');
      }
    } else {
      console.log('\nAdmin user already exists.');
    }
    
    // Also ensure test@example.com exists
    const testEmail = 'test@example.com';
    const testExists = users?.find(u => u.email === testEmail);
    
    if (!testExists) {
      console.log('\nCreating test@example.com user...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('test123', salt);
      
      const { data: testUser, error: createError } = await supabase
        .from('users')
        .insert([{
          name: 'Test User',
          email: testEmail,
          password_hash: hashedPassword,
          role: 'admin',
          is_active: true,
          phone: null,
          department: null,
          address: null
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating test user:', createError);
      } else {
        console.log('Test user created successfully!');
      }
    } else {
      console.log('\nTest user already exists.');
    }
    
    console.log('\n✅ User setup complete!');
    console.log('Available login credentials:');
    console.log('1. Email: admin@example.com, Password: admin123');
    console.log('2. Email: test@example.com, Password: test123');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAndCreateUsers();
