const mongoose = require('mongoose');

const SupplierPriceSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.ObjectId,
    ref: 'Supplier',
    required: [true, 'Please specify a supplier']
  },
  inventory: {
    type: mongoose.Schema.ObjectId,
    ref: 'Inventory',
    required: [true, 'Please specify an inventory item']
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

// Create compound index for supplier and inventory to ensure uniqueness
SupplierPriceSchema.index({ supplier: 1, inventory: 1 }, { unique: true });

// Update the updatedAt field on save
SupplierPriceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SupplierPrice', SupplierPriceSchema);
