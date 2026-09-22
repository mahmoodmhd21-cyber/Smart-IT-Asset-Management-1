const crypto = require('crypto');
const mongoose = require('mongoose');

// Create a non-guessable value that uniquely identifies an asset when scanned.
const createToken = () => crypto.randomBytes(24).toString('hex');

const qrCodeSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: createToken,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    scanCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastScannedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

qrCodeSchema.statics.createToken = createToken;

module.exports = mongoose.model('QRCode', qrCodeSchema);
