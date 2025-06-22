const mongoose = require('mongoose');

const DeviceFingerprintSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  fingerprintHash: {
    type: String,
    required: true,
    index: true
  },
  fingerprintData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deviceName: {
    type: String,
    default: function() {
      const fp = this.fingerprintData;
      if (!fp) return 'Unknown Device';
      
      // Generate a friendly device name
      const platform = fp.platform || 'Unknown';
      const browser = this.getBrowserName(fp.userAgent || '');
      return `${platform} - ${browser}`;
    }
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  location: {
    country: String,
    region: String,
    city: String,
    timezone: String
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isTrusted: {
    type: Boolean,
    default: false
  },
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  securityFlags: [{
    type: String,
    enum: [
      'headless_browser',
      'webgl_blocked', 
      'no_plugins',
      'limited_fonts',
      'privacy_focused',
      'vpn_detected',
      'tor_detected',
      'suspicious_activity'
    ]
  }],
  metadata: {
    screenResolution: String,
    timezone: String,
    language: String,
    platform: String,
    hardwareConcurrency: String,
    deviceMemory: String,
    touchSupport: Boolean,
    webglVendor: String,
    webglRenderer: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
DeviceFingerprintSchema.index({ userId: 1, fingerprintHash: 1 });
DeviceFingerprintSchema.index({ userId: 1, lastSeen: -1 });
DeviceFingerprintSchema.index({ userId: 1, isActive: 1 });
DeviceFingerprintSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Instance methods
DeviceFingerprintSchema.methods.getBrowserName = function(userAgent) {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown Browser';
};

DeviceFingerprintSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  this.loginCount += 1;
  return this.save();
};

DeviceFingerprintSchema.methods.calculateRiskScore = function() {
  let score = 0;
  
  // Base risk factors
  if (this.securityFlags.includes('headless_browser')) score += 0.5;
  if (this.securityFlags.includes('webgl_blocked')) score += 0.2;
  if (this.securityFlags.includes('no_plugins')) score += 0.1;
  if (this.securityFlags.includes('limited_fonts')) score += 0.1;
  if (this.securityFlags.includes('vpn_detected')) score += 0.3;
  if (this.securityFlags.includes('tor_detected')) score += 0.8;
  
  // Frequency-based risk
  const daysSinceFirstSeen = (Date.now() - this.firstSeen) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstSeen < 1 && this.loginCount > 10) {
    score += 0.2; // Too many logins in first day
  }
  
  this.riskScore = Math.min(score, 1);
  return this.riskScore;
};

// Static methods
DeviceFingerprintSchema.statics.findByUserAndHash = function(userId, fingerprintHash) {
  return this.findOne({ userId, fingerprintHash, isActive: true });
};

DeviceFingerprintSchema.statics.getUserDevices = function(userId, limit = 10) {
  return this.find({ userId, isActive: true })
    .sort({ lastSeen: -1 })
    .limit(limit)
    .select('-fingerprintData'); // Don't return full fingerprint data
};

DeviceFingerprintSchema.statics.getActiveSessionsCount = function(userId, timeWindow = 5) {
  const cutoff = new Date(Date.now() - timeWindow * 60 * 1000); // minutes ago
  return this.countDocuments({
    userId,
    lastSeen: { $gte: cutoff },
    isActive: true
  });
};

DeviceFingerprintSchema.statics.detectSuspiciousActivity = async function(userId) {
  const devices = await this.find({ userId, isActive: true })
    .sort({ lastSeen: -1 })
    .limit(20);
  
  const analysis = {
    totalDevices: devices.length,
    highRiskDevices: devices.filter(d => d.riskScore > 0.7).length,
    recentDevices: devices.filter(d => {
      const hoursSinceFirstSeen = (Date.now() - d.firstSeen) / (1000 * 60 * 60);
      return hoursSinceFirstSeen < 24;
    }).length,
    uniqueIPs: new Set(devices.map(d => d.ipAddress)).size,
    uniqueLocations: new Set(devices.map(d => d.location?.city).filter(Boolean)).size,
    flags: []
  };
  
  // Suspicious patterns
  if (analysis.totalDevices > 10) {
    analysis.flags.push('too_many_devices');
  }
  
  if (analysis.recentDevices > 5) {
    analysis.flags.push('rapid_device_registration');
  }
  
  if (analysis.uniqueIPs > 15) {
    analysis.flags.push('too_many_ips');
  }
  
  if (analysis.uniqueLocations > 5) {
    analysis.flags.push('geographically_distributed');
  }
  
  // Calculate overall risk score
  analysis.overallRiskScore = Math.min(
    (analysis.highRiskDevices * 0.3) +
    (analysis.recentDevices * 0.1) +
    (Math.max(0, analysis.totalDevices - 3) * 0.05) +
    (Math.max(0, analysis.uniqueIPs - 5) * 0.02),
    1
  );
  
  return analysis;
};

// Pre-save middleware
DeviceFingerprintSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('securityFlags')) {
    this.calculateRiskScore();
  }
  
  // Extract metadata from fingerprint data
  if (this.fingerprintData && this.isNew) {
    const fp = this.fingerprintData;
    this.metadata = {
      screenResolution: fp.screenResolution,
      timezone: fp.timezone,
      language: fp.language,
      platform: fp.platform,
      hardwareConcurrency: fp.hardwareConcurrency,
      deviceMemory: fp.deviceMemory,
      touchSupport: fp.touchSupport,
      webglVendor: fp.webglVendor,
      webglRenderer: fp.webglRenderer
    };
  }
  
  next();
});

module.exports = mongoose.model('DeviceFingerprint', DeviceFingerprintSchema);
