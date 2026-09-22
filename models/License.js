const mongoose = require('mongoose');

// Schema for software licenses used by the organization.
const licenseSchema = new mongoose.Schema(
  {
    // Name of the software product, for example Microsoft Office or Adobe Photoshop.
    softwareName: {
      type: String,
      required: true,
      trim: true,
    },
    // Unique key/code used to activate or identify the license.
    licenseKey: {
      type: String,
      required: true,
      trim: true,
    },
    // Company or vendor that issued/sold the license.
    vendor: {
      type: String,
      required: true,
      trim: true,
    },
    // Date the license was purchased.
    purchaseDate: {
      type: Date,
    },
    // Date when the license expires.
    expiryDate: {
      type: Date,
    },
    // Total number of users/devices allowed by this license.
    numberOfSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    // Number of seats currently assigned to users or devices.
    assignedSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Current license state.
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Suspended'],
      default: 'Active',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Prevent the same license key from being stored more than once.
licenseSchema.index({ licenseKey: 1 }, { unique: true });

module.exports = mongoose.model('License', licenseSchema);
