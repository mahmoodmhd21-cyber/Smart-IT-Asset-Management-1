const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  allocationDate: {
    type: Date,
    required: true,
  },
  returnDate: {
    type: Date,
  },
  allocationStatus: {
    type: String,
    enum: ["Allocated", "Returned", "Pending"],
    default: "Allocated",
    required: true,
  },
  remarks: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Allocation', AllocationSchema);
