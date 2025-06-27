const bcrypt = require('bcryptjs');
const { supabase } = require('./config/supabase');

async function createSuperAdminUser() {
  try {
    // Configuration - Change these values
    const userData = {
      name: 'Super Admin',
      email: 'superadmin@example.com', // Change this to your desired email
      password: 'SuperAdmin123!', // Change this to your desired password
      role: 'superadmin'
    };

    console.log('Creating superadmin user...');
    console.log('Email:', userData.email);
    console.log('Password:', userData.password);
    console.log('Role:', userData.role);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      console.log('User already exists:', existingUser);
      
      // Update existing user to superadmin role
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: 'superadmin', is_active: true })
        .eq('email', userData.email)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return;
      }

      console.log('✅ User updated to superadmin role successfully!');
      console.log('Updated user:', {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        is_active: updatedUser.is_active
      });
      return;
    }

    // Hash password using the same method as your auth controller
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    console.log('Password hashed successfully');

    // Create user in Supabase
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        name: userData.name,
        email: userData.email,
        password_hash: hashedPassword,
        role: userData.role,
        is_active: true
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return;
    }

    console.log('✅ Superadmin user created successfully!');
    console.log('User details:', {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      is_active: newUser.is_active,
      created_at: newUser.created_at
    });

    console.log('\n🔐 Login credentials:');
    console.log('Email:', userData.email);
    console.log('Password:', userData.password);
    console.log('Role:', userData.role);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
createSuperAdminUser();
