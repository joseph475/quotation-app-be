const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  itemcode: {
    type: Number,
    unique: true
  },
  barcode: {
    type: String,
    required: [true, 'Please add a barcode'],
    unique: true,
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
    trim: true
  },
  cost: {
    type: Number,
    required: [true, 'Please add a cost']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price']
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
  // Auto-increment itemcode for new documents
  if (this.isNew && !this.itemcode) {
    try {
      const lastItem = await this.constructor.findOne({}, {}, { sort: { 'itemcode': -1 } });
      this.itemcode = lastItem ? lastItem.itemcode + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  
  // Update timestamp
  this.updatedAt = Date.now();
  next();
});

// Create index for search
InventorySchema.index({ name: 'text', barcode: 'text' });

// Create unique index for barcode
InventorySchema.index({ barcode: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);
