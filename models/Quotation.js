const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: [true, 'Please add a quotation number'],
    unique: true,
    trim: true
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer']
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: [true, 'Please add a branch']
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
    enum: ['active', 'rejected', 'completed'],
    default: 'active'
  },
  validUntil: {
    type: Date,
    required: [true, 'Please add a valid until date']
  },
  notes: {
    type: String,
    trim: true
  },
  terms: {
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
QuotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Populate customer, branch, and inventory items when finding a quotation
QuotationSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'customer',
    select: 'name phone'
  }).populate({
    path: 'branch',
    select: 'name address'
  }).populate({
    path: 'items.inventory',
    select: 'name itemCode'
  });

  next();
});

module.exports = mongoose.model('Quotation', QuotationSchema);
