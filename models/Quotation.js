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
    ref: 'User',
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
        min: [0, 'Quantity must be at least 0']
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
      },
      notes: {
        type: String,
        trim: true,
        default: ''
      }
    }
  ],
  subtotal: {
    type: Number,
    default: 0
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
    enum: ['pending', 'approved', 'rejected', 'completed', 'draft', 'active', 'accepted', 'delivered'],
    default: 'pending'
  },
  assignedDelivery: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  validUntil: {
    type: Date
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

// Populate customer and inventory items when finding a quotation
QuotationSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'customer',
    select: 'name email phone'
  }).populate({
    path: 'items.inventory',
    select: 'name itemcode'
  }).populate({
    path: 'assignedDelivery',
    select: 'name email'
  }).populate({
    path: 'createdBy',
    select: 'name email'
  });

  next();
});

module.exports = mongoose.model('Quotation', QuotationSchema);
