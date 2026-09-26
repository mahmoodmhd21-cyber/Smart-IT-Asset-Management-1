const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    assetName: {
      type: String,
      required: true,
      trim: true,
    },
    // Internal transaction conflict marker and explicit maintenance reservation.
    lifecycleVersion: { type: Number, default: 0 },
    maintenanceHold: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['Available', 'Allocated', 'Maintenance', 'Retired'],
      default: 'Available',
    },
    location: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    // Missing serials remain valid for legacy inventory; populated serials are unique.
    serialNumber: { type: String, trim: true, maxlength: 120, set: value => value === '' || value === null ? undefined : value },
    purchaseDate: {
      type: Date,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

assetSchema.index({ serialNumber: 1 }, {
  unique: true,
  partialFilterExpression: { serialNumber: { $type: 'string', $gt: '' } },
  collation: { locale: 'en', strength: 2 },
});

module.exports = mongoose.model('Asset', assetSchema);
