const mongoose = require('mongoose');

const InventoryHistorySchema = new mongoose.Schema({
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
  operation: {
    type: String,
    required: [true, 'Please add an operation type'],
    enum: ['add_stock', 'update_item', 'delete_item', 'create_item']
  },
  beforeData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  afterData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  changes: {
    summary: {
      type: String,
      required: true
    },
    details: [{
      field: String,
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      change: mongoose.Schema.Types.Mixed
    }]
  },
  reason: {
    type: String,
    default: ''
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Please add a user ID']
  },
  userName: {
    type: String,
    required: [true, 'Please add a user name']
  },
  branchId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: [true, 'Please add a branch ID']
  },
  branchName: {
    type: String,
    required: [true, 'Please add a branch name']
  },
  date: {
    type: String,
    required: true
  },
  month: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
InventoryHistorySchema.index({ itemId: 1, createdAt: -1 });
InventoryHistorySchema.index({ operation: 1, createdAt: -1 });
InventoryHistorySchema.index({ date: 1 });
InventoryHistorySchema.index({ month: 1 });
InventoryHistorySchema.index({ userId: 1, createdAt: -1 });
InventoryHistorySchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryHistory', InventoryHistorySchema);
