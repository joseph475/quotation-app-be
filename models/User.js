const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch'
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  console.log('Generating JWT token for user:', this.email);
  console.log('JWT_SECRET:', process.env.JWT_SECRET);
  console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE);
  
  const token = jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
  
  console.log('Token generated successfully');
  return token;
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  console.log('Matching password for user:', this.email);
  console.log('Entered password:', enteredPassword);
  console.log('Stored hashed password:', this.password);
  
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  console.log('Password match result:', isMatch);
  
  return isMatch;
};

module.exports = mongoose.model('User', UserSchema);
