const mongoose = require('mongoose');

// Schema for tracking maintenance and repair work linked to assets.
const maintenanceSchema = new mongoose.Schema(
  {
    // Asset that this maintenance record belongs to.
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
    },
    // Type of maintenance being performed.
    maintenanceType: {
      type: String,
      enum: ['Preventive', 'Corrective', 'Repair'],
      required: true,
    },
    // Details about the issue, work performed, or planned maintenance.
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // External company or internal team handling the maintenance.
    serviceProvider: {
      type: String,
      trim: true,
    },
    // Date when the maintenance happens or happened.
    maintenanceDate: {
      type: Date,
      required: true,
    },
    // Optional follow-up date for future preventive maintenance.
    nextMaintenanceDate: {
      type: Date,
    },
    // Cost of the maintenance work.
    cost: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Current progress of the maintenance record.
    status: {
      type: String,
      enum: ['Scheduled', 'In Progress', 'Completed'],
      default: 'Scheduled',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model('Maintenance', maintenanceSchema);
