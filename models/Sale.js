const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: [true, 'Please add a sale number'],
    unique: true,
    trim: true
  },
  quotation: {
    type: mongoose.Schema.ObjectId,
    ref: 'Quotation'
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer']
  },
  items: [
    {
      inventory: {
        type: mongoose.Schema.ObjectId,
        ref: 'Inventory',
        required: [true, 'Please add an inventory item']
      },
      description: {
        type: String,
        required: [true, 'Please add a description']
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
      discount: {
        type: Number,
        default: 0
      },
      tax: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        required: [true, 'Please add a total']
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
  total: {
    type: Number,
    required: [true, 'Please add a total']
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partially_paid', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'credit_card', 'bank_transfer', 'online_payment'],
    default: 'cash'
  },
  paymentDetails: {
    type: String,
    trim: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  dueDate: {
    type: Date
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
SaleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Populate customer and inventory items when finding a sale
SaleSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'customer',
    select: 'name phone'
  }).populate({
    path: 'items.inventory',
    select: 'name itemCode'
  });

  next();
});

module.exports = mongoose.model('Sale', SaleSchema);
