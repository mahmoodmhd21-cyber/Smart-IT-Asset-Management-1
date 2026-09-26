const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: function () { return !this.user; },
  },
  // Retained only for unmapped historical assignments; new API writes require employee.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
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
  autoIndex: false,
});

// Returned history is unlimited, but a device can have only one active assignment.
AllocationSchema.index({ asset: 1 }, {
  name: 'one_active_allocation_per_asset', unique: true,
  partialFilterExpression: { allocationStatus: 'Allocated' },
});

module.exports = mongoose.model('Allocation', AllocationSchema);
