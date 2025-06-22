const express = require('express');
const {
  getUserDevices,
  getDevice,
  updateDevice,
  revokeDevice,
  getSecurityAnalysis,
  revokeAllDevices,
  getLoginHistory
} = require('../controllers/deviceFingerprint');

const router = express.Router();

const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.route('/')
  .get(getUserDevices);

router.route('/security-analysis')
  .get(getSecurityAnalysis);

router.route('/login-history')
  .get(getLoginHistory);

router.route('/revoke-all')
  .post(revokeAllDevices);

router.route('/:id')
  .get(getDevice)
  .put(updateDevice)
  .delete(revokeDevice);

module.exports = router;
