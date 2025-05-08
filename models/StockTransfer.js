const mongoose = require('mongoose');

const StockTransferSchema = new mongoose.Schema({
  transferNumber: {
    type: String,
    required: [true, 'Please add a transfer number'],
    unique: true,
    trim: true
  },
  itemId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Inventory',
    required: [true, 'Please add an inventory item']
  },
  fromBranch: {
    type: String,
    required: [true, 'Please add a source branch']
  },
  fromBranchId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: [true, 'Please add a source branch ID']
  },
  toBranch: {
    type: String,
    required: [true, 'Please add a destination branch']
  },
  toBranchId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: [true, 'Please add a destination branch ID']
  },
  quantity: {
    type: Number,
    required: [true, 'Please add a quantity'],
    min: [1, 'Quantity must be at least 1']
  },
  transferDate: {
    type: Date,
    required: [true, 'Please add a transfer date'],
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Cancelled'],
    default: 'Completed'
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Please add a user']
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

// Update the updatedAt field on save
StockTransferSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Populate references when finding a stock transfer
StockTransferSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'itemId',
    select: 'name itemCode'
  }).populate({
    path: 'createdBy',
    select: 'name email'
  });

  next();
});

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
