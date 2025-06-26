require('dotenv').config();
const { supabase } = require('./config/supabase');
const bcrypt = require('bcryptjs');

const createSupabaseTestUser = async () => {
  try {
    console.log('Creating test user in Supabase...');
    
    // Check if test user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@example.com')
      .single();
    
    if (existingUser) {
      console.log('Test user already exists. Deleting and recreating...');
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', 'test@example.com');
      
      if (deleteError) {
        console.error('Error deleting existing user:', deleteError);
      }
    }
    
    // Create a new test user with a simple password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('test123', salt);
    
    const { data: testUser, error: createError } = await supabase
      .from('users')
      .insert([{
        name: 'Test User',
        email: 'test@example.com',
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
      return;
    }
    
    console.log('Test user created successfully:');
    console.log('Email: test@example.com');
    console.log('Password: test123');
    console.log('User ID:', testUser.id);
    console.log('Name:', testUser.name);
    console.log('Role:', testUser.role);
    
    // Test password matching
    const isMatch = await bcrypt.compare('test123', testUser.password_hash);
    console.log('\nPassword match test:', isMatch ? 'SUCCESS' : 'FAILED');
    
    console.log('\n✅ Test user setup complete!');
    console.log('You can now login with:');
    console.log('Email: test@example.com');
    console.log('Password: test123');
    
  } catch (err) {
    console.error('Error creating test user:', err);
  }
};

createSupabaseTestUser();
