const mongoose = require('mongoose');

const CostHistorySchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Inventory',
    required: [true, 'Please add an item ID']
  },
  itemName: {
    type: String,
    required: [true, 'Please add an item name']
  },
  itemCode: {
    type: String,
    required: [true, 'Please add an item code']
  },
  previousCost: {
    type: Number,
    required: [true, 'Please add previous cost'],
    min: 0
  },
  newCost: {
    type: Number,
    required: [true, 'Please add new cost'],
    min: 0
  },
  costChange: {
    type: Number,
    required: true
  },
  quantityAdded: {
    type: Number,
    required: [true, 'Please add quantity added'],
    min: 0
  },
  reason: {
    type: String,
    required: [true, 'Please add a reason for cost change']
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Please add a user ID']
  },
  date: {
    type: String,
    required: true
  },
  month: {
    type: String,
    required: true
  },
  changeType: {
    type: String,
    default: 'stock_addition',
    enum: ['stock_addition', 'price_adjustment', 'correction']
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
CostHistorySchema.index({ itemId: 1, createdAt: -1 });
CostHistorySchema.index({ date: 1 });
CostHistorySchema.index({ month: 1 });
CostHistorySchema.index({ userId: 1, createdAt: -1 });
CostHistorySchema.index({ changeType: 1, createdAt: -1 });

module.exports = mongoose.model('CostHistory', CostHistorySchema);
