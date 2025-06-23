const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  itemcode: {
    type: Number,
    required: true,
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

// Auto-increment itemcode
InventorySchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const lastItem = await this.constructor.findOne({}, {}, { sort: { 'itemcode': -1 } });
      this.itemcode = lastItem ? lastItem.itemcode + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  this.updatedAt = Date.now();
  next();
});

// Create index for search
InventorySchema.index({ name: 'text', barcode: 'text' });

// Create unique index for barcode
InventorySchema.index({ barcode: 1 }, { unique: true });

// Update the updatedAt field on save
InventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Inventory', InventorySchema);
