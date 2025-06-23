const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  itemcode: {
    type: Number,
    unique: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values but unique non-null values
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  unit: {
    type: String,
    required: [true, 'Please add a unit'],
    trim: true,
    default: 'pcs'
  },
  cost: {
    type: Number,
    required: [true, 'Please add a cost'],
    default: 0
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-increment itemcode and update timestamps
InventorySchema.pre('save', async function(next) {
  // Auto-increment itemcode for new documents that don't have one
  if (this.isNew && !this.itemcode) {
    try {
      // Find the highest itemcode to continue the sequence
      const lastItem = await this.constructor.findOne({}, {}, { sort: { 'itemcode': -1 } });
      this.itemcode = lastItem ? lastItem.itemcode + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  
  // Ensure itemcode is never null or undefined
  if (!this.itemcode) {
    return next(new Error('ItemCode is required and must be set'));
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Static method to get next itemcode for manual creation
InventorySchema.statics.getNextItemCode = async function() {
  const lastItem = await this.findOne({}, {}, { sort: { 'itemcode': -1 } });
  return lastItem ? lastItem.itemcode + 1 : 1;
};

// Create index for search
InventorySchema.index({ name: 'text', barcode: 'text' });

// Create unique index for barcode
InventorySchema.index({ barcode: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);
