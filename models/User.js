const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  // Keep accounts for allocation history while allowing immediate access revocation.
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  role: {
    type: String,
    enum: ['Admin', 'IT Staff'],
    default: 'IT Staff',
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
