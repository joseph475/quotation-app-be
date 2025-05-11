const mongoose = require('mongoose');

const PurchaseReceivingSchema = new mongoose.Schema({
  receivingNumber: {
    type: String,
    required: [true, 'Please add a receiving number'],
    unique: true,
    trim: true
  },
  purchaseOrder: {
    type: mongoose.Schema.ObjectId,
    ref: 'PurchaseOrder',
    required: [true, 'Please add a purchase order']
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: [true, 'Please add a branch']
  },
  supplier: {
    type: mongoose.Schema.ObjectId,
    ref: 'Supplier',
    required: [true, 'Please add a supplier']
  },
  receivingDate: {
    type: Date,
    required: [true, 'Please add a receiving date'],
    default: Date.now
  },
  items: [
    {
      purchaseOrderItem: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Please add a purchase order item reference']
      },
      inventory: {
        type: mongoose.Schema.ObjectId,
        ref: 'Inventory'
      },
      name: {
        type: String,
        required: [true, 'Please add an item name']
      },
      quantityOrdered: {
        type: Number,
        required: [true, 'Please add quantity ordered']
      },
      quantityReceived: {
        type: Number,
        required: [true, 'Please add quantity received'],
        min: [1, 'Quantity received must be at least 1']
      },
      previouslyReceived: {
        type: Number,
        default: 0
      },
      notes: {
        type: String,
        trim: true
      }
    }
  ],
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Completed'
  },
  notes: {
    type: String,
    trim: true
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
PurchaseReceivingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Populate references when finding a purchase receiving
PurchaseReceivingSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'purchaseOrder',
    select: 'orderNumber orderDate expectedDeliveryDate'
  }).populate({
    path: 'supplier',
    select: 'name email phone'
  }).populate({
    path: 'items.inventory',
    select: 'name itemCode'
  });

  next();
});

module.exports = mongoose.model('PurchaseReceiving', PurchaseReceivingSchema);
