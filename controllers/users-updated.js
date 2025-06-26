const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get all users
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};

/**
 * @desc    Get single user
 * @route   GET /api/v1/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: `No user found with id ${req.params.id}`
        });
      }
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};

/**
 * @desc    Create user
 * @route   POST /api/v1/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, department, address, is_active, password, role, branch } = req.body;

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with that email already exists'
      });
    }

    // Get environment variable for customer role limit
    const maxCustomerRoleUsers = parseInt(process.env.MAX_CUSTOMER_ROLE_USERS) || 3;

    // Determine the actual role that will be assigned (updated from 'user' to 'customer')
    const actualRole = role || 'customer';
    
    // Check if trying to create a user with role 'customer' and if limit is reached
    if (actualRole === 'customer') {
      const { count: customerRoleCount, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      if (countError) {
        throw countError;
      }
      
      if (customerRoleCount >= maxCustomerRoleUsers) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit of ${maxCustomerRoleUsers} users with role 'customer' has been reached`
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Set branch to 'All' if role is admin
    const userBranch = role === 'admin' ? 'All' : branch || '';

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        name,
        email,
        phone,
        department,
        address,
        is_active: is_active !== undefined ? is_active : true,
        password_hash: hashedPassword,
        role: actualRole,
        branch: userBranch
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Remove password_hash from response
    delete user.password_hash;

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/v1/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res) => {
  try {
    // Remove password from update if it exists
    if (req.body.password) {
      delete req.body.password;
    }
    
    // Get current user to check if role is being changed
    const { data: currentUser, error: getCurrentError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (getCurrentError) {
      if (getCurrentError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: `No user found with id ${req.params.id}`
        });
      }
      throw getCurrentError;
    }

    // Check if trying to change role to 'customer' and if limit is reached
    if (req.body.role === 'customer' && currentUser.role !== 'customer') {
      const maxCustomerRoleUsers = parseInt(process.env.MAX_CUSTOMER_ROLE_USERS) || 3;
      
      const { count: customerRoleCount, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      if (countError) {
        throw countError;
      }
      
      if (customerRoleCount >= maxCustomerRoleUsers) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit of ${maxCustomerRoleUsers} users with role 'customer' has been reached`
        });
      }
    }
    
    // Set branch to 'All' if role is admin
    if (req.body.role === 'admin') {
      req.body.branch = 'All';
    }
    
    // Update user
    const { data: user, error } = await supabase
      .from('users')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Remove password_hash from response
    delete user.password_hash;
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: `No user found with id ${req.params.id}`
        });
      }
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};

/**
 * @desc    Get user role statistics
 * @route   GET /api/v1/users/stats/roles
 * @access  Private/Admin
 */
exports.getUserRoleStats = async (req, res) => {
  try {
    const maxCustomerRoleUsers = parseInt(process.env.MAX_CUSTOMER_ROLE_USERS) || 3;
    
    // Get counts for each role
    const { count: customerRoleCount, error: customerError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer');

    if (customerError) {
      throw customerError;
    }

    const { count: adminRoleCount, error: adminError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (adminError) {
      throw adminError;
    }

    const { count: totalUsers, error: totalError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw totalError;
    }
    
    res.status(200).json({
      success: true,
      data: {
        roles: {
          customer: customerRoleCount,
          admin: adminRoleCount,
          total: totalUsers
        },
        limits: {
          maxCustomerRoleUsers: maxCustomerRoleUsers,
          remainingCustomerSlots: Math.max(0, maxCustomerRoleUsers - customerRoleCount)
        }
      }
    });
  } catch (err) {
    console.error('Get user role stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};

/**
 * @desc    Get customers only
 * @route   GET /api/v1/users/customers
 * @access  Private
 */
exports.getCustomers = async (req, res) => {
  try {
    const { data: customers, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'customer')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Remove password_hash from response
    const sanitizedCustomers = customers.map(customer => {
      const { password_hash, ...customerData } = customer;
      return customerData;
    });
    
    res.status(200).json({
      success: true,
      count: sanitizedCustomers.length,
      data: sanitizedCustomers
    });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};

/**
 * @desc    Get staff only (admin, delivery, etc.)
 * @route   GET /api/v1/users/staff
 * @access  Private/Admin
 */
exports.getStaff = async (req, res) => {
  try {
    const { data: staff, error } = await supabase
      .from('users')
      .select('*')
      .neq('role', 'customer')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Remove password_hash from response
    const sanitizedStaff = staff.map(staffMember => {
      const { password_hash, ...staffData } = staffMember;
      return staffData;
    });
    
    res.status(200).json({
      success: true,
      count: sanitizedStaff.length,
      data: sanitizedStaff
    });
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error: ' + err.message
    });
  }
};
