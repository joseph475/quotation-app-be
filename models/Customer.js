const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  contactPerson: {
    type: String,
    required: [true, 'Please add a contact person'],
    trim: true,
    maxlength: [100, 'Contact person name cannot be more than 100 characters']
  },
  phone: {
    type: String,
    maxlength: [20, 'Phone number cannot be more than 20 characters']
  },
  address: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },
  customerType: {
    type: String,
    enum: ['individual', 'business', 'government'],
    default: 'individual'
  },
  notes: {
    type: String,
    trim: true
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
CustomerSchema.index({ name: 'text', contactPerson: 'text', phone: 'text' });

// Update the updatedAt field on save
CustomerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);
