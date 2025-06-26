const { supabase } = require('./config/supabase');
const bcrypt = require('bcryptjs');

async function testSupabaseAuth() {
  try {
    console.log('Testing Supabase connection...');
    
    // Check if users table exists and has data
    console.log('Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (usersError) {
      console.error('Error querying users table:', usersError);
      return;
    }
    
    console.log('Users found:', users?.length || 0);
    if (users && users.length > 0) {
      console.log('Sample user:', {
        id: users[0].id,
        email: users[0].email,
        name: users[0].name,
        role: users[0].role,
        is_active: users[0].is_active
      });
    }
    
    // If no users exist, create a test user
    if (!users || users.length === 0) {
      console.log('No users found. Creating test user...');
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          name: 'Test User',
          email: 'test@example.com',
          password_hash: hashedPassword,
          role: 'user',
          is_active: true
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating test user:', createError);
        return;
      }
      
      console.log('Test user created successfully:', {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      });
    }
    
    // Test login with existing user
    console.log('\nTesting login logic...');
    const testEmail = 'test@example.com';
    const testPassword = 'password123';
    
    const { data: user, error: loginError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .single();
    
    if (loginError) {
      console.error('Error finding user for login test:', loginError);
      return;
    }
    
    if (!user) {
      console.log('No user found with email:', testEmail);
      return;
    }
    
    console.log('User found for login test:', {
      id: user.id,
      email: user.email,
      has_password_hash: !!user.password_hash
    });
    
    // Test password comparison
    const isMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log('Password match test:', isMatch);
    
    if (isMatch) {
      console.log('✅ Authentication test successful!');
    } else {
      console.log('❌ Password does not match');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSupabaseAuth();
