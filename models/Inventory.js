const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: [true, 'Please add an item code'],
    trim: true,
    maxlength: [20, 'Item code cannot be more than 20 characters']
  },
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [50, 'Brand cannot be more than 50 characters']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [50, 'Model cannot be more than 50 characters']
  },
  color: {
    type: String,
    trim: true,
    maxlength: [30, 'Color cannot be more than 30 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    trim: true
  },
  unit: {
    type: String,
    required: [true, 'Please add a unit'],
    trim: true
  },
  costPrice: {
    type: Number,
    required: [true, 'Please add a cost price']
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add a selling price']
  },
  discount: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    required: [true, 'Please add a quantity'],
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 10
  },
  supplier: {
    type: mongoose.Schema.ObjectId,
    ref: 'Supplier'
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

// Create index for search
InventorySchema.index({ name: 'text', description: 'text', itemCode: 'text', brand: 'text', model: 'text', color: 'text' });

// Create unique index for itemCode
InventorySchema.index({ itemCode: 1 }, { unique: true });

// Update the updatedAt field on save
InventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Inventory', InventorySchema);
