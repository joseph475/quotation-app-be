const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: [true, 'Please add an order number'],
    unique: true,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.ObjectId,
    ref: 'Supplier',
    required: [true, 'Please add a supplier']
  },
  orderDate: {
    type: Date,
    required: [true, 'Please add an order date'],
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date,
    required: [true, 'Please add an expected delivery date']
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Completed', 'Cancelled'],
    default: 'Draft'
  },
  items: [
    {
      inventory: {
        type: mongoose.Schema.ObjectId,
        ref: 'Inventory'
      },
      name: {
        type: String,
        required: [true, 'Please add an item name']
      },
      quantity: {
        type: Number,
        required: [true, 'Please add a quantity'],
        min: [1, 'Quantity must be at least 1']
      },
      unitPrice: {
        type: Number,
        required: [true, 'Please add a unit price']
      },
      total: {
        type: Number,
        required: [true, 'Please add a total']
      },
      receivedQuantity: {
        type: Number,
        default: 0
      }
    }
  ],
  subtotal: {
    type: Number,
    required: [true, 'Please add a subtotal']
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Please add a total amount']
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
PurchaseOrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Populate supplier and inventory items when finding a purchase order
PurchaseOrderSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'supplier',
    select: 'name email phone'
  }).populate({
    path: 'items.inventory',
    select: 'name itemCode'
  });

  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
