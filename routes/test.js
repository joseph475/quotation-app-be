const express = require('express');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const router = express.Router();

// Test endpoint to check if fingerprinting is working
router.post('/fingerprint-test', async (req, res) => {
  try {
    console.log('Test fingerprint endpoint called');
    console.log('Request body:', req.body);
    
    const { deviceFingerprint, userId } = req.body;
    
    if (!deviceFingerprint) {
      return res.status(400).json({
        success: false,
        message: 'No fingerprint data provided'
      });
    }
    
    // Create a test device fingerprint
    const testDevice = await DeviceFingerprint.create({
      userId: userId || 'test-user-id',
      fingerprintHash: 'test-hash-' + Date.now(),
      fingerprintData: deviceFingerprint,
      ipAddress: req.ip || 'test-ip',
      userAgent: req.headers['user-agent'] || 'test-agent',
      securityFlags: [],
      location: {
        timezone: deviceFingerprint.timezone || 'UTC'
      }
    });
    
    res.json({
      success: true,
      message: 'Test fingerprint created successfully',
      deviceId: testDevice._id,
      data: testDevice
    });
  } catch (error) {
    console.error('Test fingerprint error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test endpoint to list all devices
router.get('/devices-test', async (req, res) => {
  try {
    const devices = await DeviceFingerprint.find({}).limit(10);
    res.json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    console.error('Test devices list error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
