const User = require('../models/User');

/**
 * @desc    Get all users
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
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
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
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
    const { name, email, phone, department, address, isActive, password, role, branch } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with that email already exists'
      });
    }

    // Get environment variable for user role limit
    const maxUserRoleUsers = parseInt(process.env.MAX_USER_ROLE_USERS) || 3;

    // Determine the actual role that will be assigned
    const actualRole = role || 'user';
    
    // Check if trying to create a user with role 'user' and if limit is reached
    if (actualRole === 'user') {
      const userRoleCount = await User.countDocuments({ role: 'user' });
      
      if (userRoleCount >= maxUserRoleUsers) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit of ${maxUserRoleUsers} users with role 'user' has been reached`
        });
      }
    }

    // Set branch to 'All' if role is admin
    const userBranch = role === 'admin' ? 'All' : branch || '';

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      department,
      address,
      isActive: isActive !== undefined ? isActive : true,
      password,
      role: role || 'user',
      branch: userBranch
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
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
    const currentUser = await User.findById(req.params.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }

    // Check if trying to change role to 'user' and if limit is reached
    if (req.body.role === 'user' && currentUser.role !== 'user') {
      const maxUserRoleUsers = parseInt(process.env.MAX_USER_ROLE_USERS) || 3;
      const userRoleCount = await User.countDocuments({ role: 'user' });
      
      if (userRoleCount >= maxUserRoleUsers) {
        return res.status(400).json({
          success: false,
          message: `Maximum limit of ${maxUserRoleUsers} users with role 'user' has been reached`
        });
      }
    }
    
    // Set branch to 'All' if role is admin
    if (req.body.role === 'admin') {
      req.body.branch = 'All';
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
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
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
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
    const maxUserRoleUsers = parseInt(process.env.MAX_USER_ROLE_USERS) || 3;
    
    // Get counts for each role
    const userRoleCount = await User.countDocuments({ role: 'user' });
    const adminRoleCount = await User.countDocuments({ role: 'admin' });
    const totalUsers = await User.countDocuments();
    
    res.status(200).json({
      success: true,
      data: {
        roles: {
          user: userRoleCount,
          admin: adminRoleCount,
          total: totalUsers
        },
        limits: {
          maxUserRoleUsers: maxUserRoleUsers,
          remainingUserSlots: Math.max(0, maxUserRoleUsers - userRoleCount)
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
