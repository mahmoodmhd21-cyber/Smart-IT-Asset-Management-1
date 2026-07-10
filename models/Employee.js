const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Employee', employeeSchema);
