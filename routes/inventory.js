const express = require('express');
const multer = require('multer');
const {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  searchInventory,
  importExcel
} = require('../controllers/inventory');

const router = express.Router();

// Import middleware
const { protect } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    if (file.mimetype === 'application/vnd.ms-excel' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Apply protect middleware to all routes
router.use(protect);

// Define routes
router.route('/')
  .get(getInventory)
  .post(createInventoryItem);

// Define special routes first
router.get('/search-items', searchInventory);
router.post('/import-excel', upload.single('file'), importExcel);

// Define parameterized routes last

router.route('/:id')
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

module.exports = router;
