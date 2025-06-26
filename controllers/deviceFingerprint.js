const { supabase } = require('../config/supabase');
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
      const { data: allDevicesData, error } = await supabase
        .from('DeviceFingerprint')
        .select('*')
        .order('lastSeen', { ascending: false });
      
      if (error) throw error;
      allDevices = allDevicesData || [];
      query = 'all users';
    } else {
      console.log('Regular user - fetching devices for this user only');
      const { data: allDevicesData, error } = await supabase
        .from('DeviceFingerprint')
        .select('*')
        .eq('userId', req.user.id)
        .order('lastSeen', { ascending: false });
      
      if (error) throw error;
      allDevices = allDevicesData || [];
      query = req.user.id;
    }
    
    console.log('All devices found:', allDevices.length);
    console.log('Device details:', allDevices.map(d => ({
      id: d._id,
      userId: d.userId,
      is_active: d.is_active,
      lastSeen: d.lastSeen,
      deviceName: d.deviceName
    })));
    
    // Calculate active count
    let activeCount = 0;
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      // For regular users, count their active devices
      activeCount = allDevices.filter(d => d.is_active).length;
      console.log('Active devices for user:', activeCount);
    } else {
      // For admins, count all active devices
      activeCount = allDevices.filter(d => d.is_active).length;
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
    const { data: device, error } = await supabase
      .from('DeviceFingerprint')
      .select('*')
      .eq('id', req.params.id)
      .eq('userId', req.user.id)
      .single();

    if (error) throw error;

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
    
    // First get the device to check if it exists
    const { data: device, error: fetchError } = await supabase
      .from('DeviceFingerprint')
      .select('*')
      .eq('id', req.params.id)
      .eq('userId', req.user.id)
      .single();

    if (fetchError) throw fetchError;

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (typeof isTrusted === 'boolean') {
      updateData.isTrusted = isTrusted;
    }
    if (deviceName && typeof deviceName === 'string') {
      updateData.deviceName = deviceName.trim();
    }

    // Update the device
    const { data: updatedDevice, error: updateError } = await supabase
      .from('DeviceFingerprint')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('userId', req.user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      data: updatedDevice
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
    // First check if device exists
    const { data: device, error: fetchError } = await supabase
      .from('DeviceFingerprint')
      .select('*')
      .eq('id', req.params.id)
      .eq('userId', req.user.id)
      .single();

    if (fetchError) throw fetchError;

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Update device to inactive
    const { error: updateError } = await supabase
      .from('DeviceFingerprint')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('userId', req.user.id);

    if (updateError) throw updateError;

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
    // Get user's devices for analysis
    const { data: devices, error } = await supabase
      .from('DeviceFingerprint')
      .select('*')
      .eq('userId', req.user.id);

    if (error) throw error;

    // Basic security analysis
    const activeDevices = devices?.filter(d => d.is_active) || [];
    const totalDevices = devices?.length || 0;
    const recentLogins = devices?.filter(d => {
      const lastSeen = new Date(d.lastSeen);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastSeen > dayAgo;
    }) || [];

    const analysis = {
      totalDevices,
      activeDevices: activeDevices.length,
      recentLogins: recentLogins.length,
      suspiciousActivity: false, // Basic implementation
      riskLevel: 'low' // Basic implementation
    };
    
    res.status(200).json({
      success: true,
      data: {
        ...analysis,
        activeSessionsCount: activeDevices.length,
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
    
    // Build the update query
    let query = supabase
      .from('DeviceFingerprint')
      .update({ is_active: false })
      .eq('userId', req.user.id)
      .eq('is_active', true);
    
    // If current device ID is provided, exclude it
    if (currentDeviceId) {
      query = query.neq('id', currentDeviceId);
    }
    
    const { data, error } = await query;

    if (error) throw error;

    const modifiedCount = data?.length || 0;

    res.status(200).json({
      success: true,
      message: `${modifiedCount} devices revoked successfully`
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
    const offset = (page - 1) * limit;
    
    // Get devices with pagination
    const { data: devices, error: devicesError } = await supabase
      .from('DeviceFingerprint')
      .select('*')
      .eq('userId', req.user.id)
      .order('lastSeen', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    if (devicesError) throw devicesError;
    
    // Get total count
    const { count: total, error: countError } = await supabase
      .from('DeviceFingerprint')
      .select('*', { count: 'exact', head: true })
      .eq('userId', req.user.id);
    
    if (countError) throw countError;
    
    res.status(200).json({
      success: true,
      count: devices?.length || 0,
      total: total || 0,
      page: parseInt(page),
      pages: Math.ceil((total || 0) / limit),
      data: devices || []
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
