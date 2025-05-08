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
    const { name, email, password, role, branch } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with that email already exists'
      });
    }

    // Set branch to 'All' if role is admin
    const userBranch = role === 'admin' ? 'All' : branch || '';

    // Create user
    const user = await User.create({
      name,
      email,
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
    
    // Set branch to 'All' if role is admin
    if (req.body.role === 'admin') {
      req.body.branch = 'All';
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
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
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }
    
    await user.remove();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
