const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  try {
    // Only deactivate device sessions for non-admin users
    if (req.user && req.user.id) {
      if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        console.log(`Admin user logout - not deactivating device sessions for user: ${req.user.id}`);
      } else {
        await DeviceFingerprint.updateMany(
          { userId: req.user.id, isActive: true },
          { isActive: false }
        );
        console.log(`Deactivated all sessions for user: ${req.user.id}`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });

    // Send token response
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password, deviceFingerprint } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user account is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    // Process device fingerprint if provided (skip for admin roles)
    let securityAnalysis = null;
    console.log('Checking for device fingerprint in request body...');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Device fingerprint exists:', !!deviceFingerprint);
    console.log('User role:', user.role);
    
    // Skip fingerprinting for admin roles
    if (user.role === 'admin' || user.role === 'superadmin') {
      console.log('Admin user detected - skipping device fingerprinting restrictions');
    } else if (deviceFingerprint) {
      try {
        console.log('Processing device fingerprint for user:', user._id);
        console.log('Fingerprint data received:', Object.keys(deviceFingerprint));
        console.log('Sample fingerprint data:', {
          userAgent: deviceFingerprint.userAgent?.substring(0, 50) + '...',
          platform: deviceFingerprint.platform,
          timezone: deviceFingerprint.timezone
        });
        
        securityAnalysis = await processDeviceFingerprint(user._id, deviceFingerprint, req);
        console.log('Security analysis result:', securityAnalysis);
      } catch (fpError) {
        console.error('Fingerprint processing error:', fpError);
        console.error('Error stack:', fpError.stack);
        
        // If the error is about session limits or device sharing, block the login
        if (fpError.message.includes('already logged in') || 
            fpError.message.includes('already registered to another account')) {
          return res.status(403).json({
            success: false,
            message: fpError.message
          });
        }
        
        // For other fingerprinting errors, continue with login
        console.log('Non-blocking fingerprint error, continuing with login...');
      }
    } else {
      console.log('No device fingerprint provided in login request');
      console.log('Full request body:', JSON.stringify(req.body, null, 2));
    }

    // Send token response with security analysis
    sendTokenResponse(user, 200, res, securityAnalysis);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

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
 * @desc    Update user details
 * @route   PUT /api/v1/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
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
 * @desc    Update password
 * @route   PUT /api/v1/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Process device fingerprint for security analysis
 */
const processDeviceFingerprint = async (userId, fingerprintData, req) => {
  try {
    console.log('=== PROCESSING DEVICE FINGERPRINT ===');
    console.log('User ID:', userId);
    console.log('User ID type:', typeof userId);
    console.log('Fingerprint data keys:', Object.keys(fingerprintData));
    
    // Generate fingerprint hash
    console.log('Generating fingerprint hash...');
    const fingerprintHash = generateFingerprintHash(fingerprintData);
    console.log('Generated hash:', fingerprintHash);
    
    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    console.log('IP Address:', ipAddress);
    console.log('User Agent:', userAgent.substring(0, 50) + '...');
    
    // Device sharing check disabled
    console.log('Device sharing check disabled - allowing multiple users per device');
    
    // Check if this device fingerprint already exists for this user
    console.log('Checking for existing device for this user...');
    let deviceFingerprint = await DeviceFingerprint.findByUserAndHash(userId, fingerprintHash);
    console.log('Existing device found for this user:', !!deviceFingerprint);
    
    if (deviceFingerprint) {
      // Update existing device
      console.log('Updating existing device...');
      await deviceFingerprint.updateLastSeen();
      console.log('Device updated successfully');
    } else {
      // Create new device fingerprint
      console.log('Creating new device fingerprint...');
      const securityFlags = analyzeSecurityFlags(fingerprintData);
      console.log('Security flags:', securityFlags);
      
      const deviceData = {
        userId,
        fingerprintHash,
        fingerprintData,
        ipAddress,
        userAgent,
        securityFlags,
        location: {
          timezone: fingerprintData.timezone
        }
      };
      console.log('Device data to create:', {
        userId: deviceData.userId,
        fingerprintHash: deviceData.fingerprintHash,
        ipAddress: deviceData.ipAddress,
        securityFlags: deviceData.securityFlags,
        timezone: deviceData.location.timezone
      });
      
      deviceFingerprint = await DeviceFingerprint.create(deviceData);
      console.log('New device created with ID:', deviceFingerprint._id);
    }
    
    // Perform security analysis
    const suspiciousActivity = await DeviceFingerprint.detectSuspiciousActivity(userId);
    const activeSessionsCount = await DeviceFingerprint.getActiveSessionsCount(userId);
    
    // Check for concurrent session limits
    const MAX_CONCURRENT_SESSIONS = 1;
    
    // Count active sessions EXCLUDING the current device (before it becomes active)
    const otherActiveSessionsCount = await DeviceFingerprint.countDocuments({
      userId,
      isActive: true,
      _id: { $ne: deviceFingerprint._id }
    });
    
    console.log(`Other active sessions: ${otherActiveSessionsCount}, Max allowed: ${MAX_CONCURRENT_SESSIONS}`);
    
    // Session limit check disabled
    console.log('Session limit check disabled - allowing multiple concurrent sessions');
    
    // For existing devices, just activate them (they can always log back in)
    if (deviceFingerprint.loginCount > 1) {
      console.log('Existing device logging back in - allowing login');
      deviceFingerprint.isActive = true;
      await deviceFingerprint.save();
    }
    
    const sessionLimitExceeded = activeSessionsCount > MAX_CONCURRENT_SESSIONS;
    
    return {
      deviceId: deviceFingerprint._id,
      isNewDevice: deviceFingerprint.loginCount === 1,
      riskScore: deviceFingerprint.riskScore,
      securityFlags: deviceFingerprint.securityFlags,
      suspiciousActivity,
      activeSessionsCount,
      sessionLimitExceeded,
      warnings: generateSecurityWarnings(deviceFingerprint, suspiciousActivity, sessionLimitExceeded)
    };
  } catch (error) {
    console.error('Error processing device fingerprint:', error);
    throw error;
  }
};

/**
 * Generate hash from fingerprint data
 */
const generateFingerprintHash = (fingerprintData) => {
  const relevantData = {
    userAgent: fingerprintData.userAgent,
    screenResolution: fingerprintData.screenResolution,
    timezone: fingerprintData.timezone,
    language: fingerprintData.language,
    platform: fingerprintData.platform,
    canvasFingerprint: fingerprintData.canvasFingerprint,
    webglVendor: fingerprintData.webglVendor,
    webglRenderer: fingerprintData.webglRenderer,
    availableFonts: fingerprintData.availableFonts
  };
  
  const dataString = JSON.stringify(relevantData);
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

/**
 * Analyze security flags from fingerprint data
 */
const analyzeSecurityFlags = (fingerprintData) => {
  const flags = [];
  
  if (fingerprintData.userAgent && fingerprintData.userAgent.includes('HeadlessChrome')) {
    flags.push('headless_browser');
  }
  
  if (fingerprintData.webglVendor === 'unknown' || fingerprintData.webglRenderer === 'unknown') {
    flags.push('webgl_blocked');
  }
  
  if (fingerprintData.pluginCount === 0) {
    flags.push('no_plugins');
  }
  
  if (fingerprintData.availableFonts && fingerprintData.availableFonts.split(',').length < 5) {
    flags.push('limited_fonts');
  }
  
  if (fingerprintData.doNotTrack === '1') {
    flags.push('privacy_focused');
  }
  
  return flags;
};

/**
 * Generate security warnings based on analysis
 */
const generateSecurityWarnings = (deviceFingerprint, suspiciousActivity, sessionLimitExceeded) => {
  const warnings = [];
  
  if (deviceFingerprint.riskScore > 0.7) {
    warnings.push('High-risk device detected');
  }
  
  if (deviceFingerprint.loginCount === 1) {
    warnings.push('Login from new device');
  }
  
  if (suspiciousActivity.overallRiskScore > 0.5) {
    warnings.push('Suspicious account activity detected');
  }
  
  if (sessionLimitExceeded) {
    warnings.push('Maximum concurrent sessions exceeded');
  }
  
  if (suspiciousActivity.flags.includes('too_many_devices')) {
    warnings.push('Too many devices registered');
  }
  
  if (suspiciousActivity.flags.includes('geographically_distributed')) {
    warnings.push('Logins from multiple locations');
  }
  
  return warnings;
};

/**
 * Get token from model, create cookie and send response
 */
const sendTokenResponse = (user, statusCode, res, securityAnalysis = null) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  const response = {
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      department: user.department,
      isActive: user.isActive,
      role: user.role,
      branch: user.branch
    }
  };

  // Add security analysis if available
  if (securityAnalysis) {
    response.security = {
      deviceId: securityAnalysis.deviceId,
      isNewDevice: securityAnalysis.isNewDevice,
      riskScore: securityAnalysis.riskScore,
      warnings: securityAnalysis.warnings,
      activeSessionsCount: securityAnalysis.activeSessionsCount,
      sessionLimitExceeded: securityAnalysis.sessionLimitExceeded
    };
  }

  res.status(statusCode).json(response);
};
