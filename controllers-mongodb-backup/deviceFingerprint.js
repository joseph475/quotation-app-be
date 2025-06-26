const DeviceFingerprint = require('../models/DeviceFingerprint');

/**
 * @desc    Get user's devices
 * @route   GET /api/v1/devices
 * @access  Private
 */
exports.getUserDevices = async (req, res) => {
  try {
    console.log('Getting devices for user:', req.user.id);
    console.log('User role:', req.user.role);
    
    let allDevices;
    let query;
    
    // If admin, show all devices across all users
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      console.log('Admin user - fetching all devices across all users');
      allDevices = await DeviceFingerprint.find({})
        .populate('userId', 'name email role')
        .sort({ lastSeen: -1 })
        .select('-fingerprintData');
      query = 'all users';
    } else {
      console.log('Regular user - fetching devices for this user only');
      allDevices = await DeviceFingerprint.find({ userId: req.user.id })
        .sort({ lastSeen: -1 })
        .select('-fingerprintData');
      query = req.user.id;
    }
    
    console.log('All devices found:', allDevices.length);
    console.log('Device details:', allDevices.map(d => ({
      id: d._id,
      userId: d.userId,
      isActive: d.isActive,
      lastSeen: d.lastSeen,
      deviceName: d.deviceName
    })));
    
    // For regular users, also get active count using static method
    let activeCount = 0;
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const activeDevices = await DeviceFingerprint.getUserDevices(req.user.id, 20);
      activeCount = activeDevices.length;
      console.log('Active devices from static method:', activeCount);
    } else {
      activeCount = allDevices.filter(d => d.isActive).length;
      console.log('Total active devices (admin view):', activeCount);
    }
    
    res.status(200).json({
      success: true,
      count: allDevices.length,
      data: allDevices,
      activeCount: activeCount,
      isAdminView: req.user.role === 'admin' || req.user.role === 'superadmin',
      query: query
    });
  } catch (err) {
    console.error('Error getting user devices:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get device by ID
 * @route   GET /api/v1/devices/:id
 * @access  Private
 */
exports.getDevice = async (req, res) => {
  try {
    const device = await DeviceFingerprint.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).select('-fingerprintData');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Update device (trust/untrust, rename)
 * @route   PUT /api/v1/devices/:id
 * @access  Private
 */
exports.updateDevice = async (req, res) => {
  try {
    const { isTrusted, deviceName } = req.body;
    
    const device = await DeviceFingerprint.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Update allowed fields
    if (typeof isTrusted === 'boolean') {
      device.isTrusted = isTrusted;
    }
    
    if (deviceName && typeof deviceName === 'string') {
      device.deviceName = deviceName.trim();
    }

    await device.save();

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Revoke/deactivate device
 * @route   DELETE /api/v1/devices/:id
 * @access  Private
 */
exports.revokeDevice = async (req, res) => {
  try {
    const device = await DeviceFingerprint.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    device.isActive = false;
    await device.save();

    res.status(200).json({
      success: true,
      message: 'Device revoked successfully'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get security analysis for user
 * @route   GET /api/v1/devices/security-analysis
 * @access  Private
 */
exports.getSecurityAnalysis = async (req, res) => {
  try {
    const analysis = await DeviceFingerprint.detectSuspiciousActivity(req.user.id);
    const activeSessionsCount = await DeviceFingerprint.getActiveSessionsCount(req.user.id);
    
    res.status(200).json({
      success: true,
      data: {
        ...analysis,
        activeSessionsCount,
        timestamp: new Date()
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Revoke all devices except current
 * @route   POST /api/v1/devices/revoke-all
 * @access  Private
 */
exports.revokeAllDevices = async (req, res) => {
  try {
    const { currentDeviceId } = req.body;
    
    const updateQuery = {
      userId: req.user.id,
      isActive: true
    };
    
    // If current device ID is provided, exclude it
    if (currentDeviceId) {
      updateQuery._id = { $ne: currentDeviceId };
    }
    
    const result = await DeviceFingerprint.updateMany(
      updateQuery,
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} devices revoked successfully`
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get login history with device information
 * @route   GET /api/v1/devices/login-history
 * @access  Private
 */
exports.getLoginHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const devices = await DeviceFingerprint.find({ userId: req.user.id })
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-fingerprintData');
    
    const total = await DeviceFingerprint.countDocuments({ userId: req.user.id });
    
    res.status(200).json({
      success: true,
      count: devices.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: devices
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
