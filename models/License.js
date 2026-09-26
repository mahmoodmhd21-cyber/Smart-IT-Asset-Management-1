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
    // Null preserves "unknown" for older records instead of inventing a license type/cost.
    licenseType: { type: String, enum: ['Perpetual', 'Subscription', 'Trial', 'Open Source'], default: null },
    cost: { type: Number, min: 0, default: null,
      validate: { validator: value => value === null || Number.isFinite(value), message: 'Cost must be finite.' } },
    notes: { type: String, trim: true, default: '' },
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
      validate: { validator: Number.isSafeInteger, message: 'Seat counts must be whole numbers.' },
    },
    // Number of seats currently assigned to users or devices.
    assignedSeats: {
      type: Number,
      default: 0,
      min: 0,
      validate: [
        { validator: Number.isSafeInteger, message: 'Assigned seats must be a whole number.' },
        { validator: function (value) { return value <= this.numberOfSeats; }, message: 'Assigned seats cannot exceed purchased seats.' },
      ],
    },
    // Current license state.
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Expiring Soon', 'Suspended'],
      default: 'Active',
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// Run even when only the purchased-seat count changed on an existing document.
licenseSchema.pre('validate', function () {
  if (this.assignedSeats > this.numberOfSeats) {
    this.invalidate('assignedSeats', 'Assigned seats cannot exceed purchased seats.');
  }
});

// Prevent the same license key from being stored more than once.
licenseSchema.index({ licenseKey: 1 }, { unique: true });

module.exports = mongoose.model('License', licenseSchema);
