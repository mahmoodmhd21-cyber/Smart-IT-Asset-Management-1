const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');

// Fields that are allowed to be created or updated through the API.
const allowedFields = [
  'asset',
  'maintenanceType',
  'description',
  'serviceProvider',
  'maintenanceDate',
  'nextMaintenanceDate',
  'cost',
  'status',
];

// Copy only approved fields from the request body.
const pickAllowedFields = (body) => {
  const payload = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  return payload;
};

// Validate the referenced asset ID when an asset field is provided.
const validateAssetId = (asset) => {
  if (asset === undefined) return true;
  return mongoose.Types.ObjectId.isValid(asset);
};

// Convert common Mongoose validation errors into consistent API responses.
const handleMaintenanceError = (res, err, fallbackMessage) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((error) => error.message).join(', '),
    });
  }

  return res.status(500).json({ success: false, message: fallbackMessage, error: err.message });
};

// Create a new maintenance or repair record.
const addMaintenance = async (req, res) => {
  try {
    const payload = pickAllowedFields(req.body);

    if (!validateAssetId(payload.asset)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    const maintenance = await Maintenance.create(payload);
    return res.status(201).json({ success: true, data: maintenance });
  } catch (err) {
    console.error('createMaintenance error:', err);
    return handleMaintenanceError(res, err, 'Failed to create maintenance record');
  }
};

// Retrieve all maintenance records with their related asset details.
const getAllMaintenance = async (req, res) => {
  try {
    const records = await Maintenance.find().populate('asset').lean();
    return res.status(200).json({ success: true, data: records });
  } catch (err) {
    console.error('getAllMaintenance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance records', error: err.message });
  }
};

// Retrieve one maintenance record by MongoDB ID.
const getMaintenanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance ID' });
    }

    const maintenance = await Maintenance.findById(id).populate('asset').lean();
    if (!maintenance) return res.status(404).json({ success: false, message: 'Maintenance record not found' });

    return res.status(200).json({ success: true, data: maintenance });
  } catch (err) {
    console.error('getMaintenanceById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance record', error: err.message });
  }
};

// Update allowed fields for one maintenance record.
const updateMaintenance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance ID' });
    }

    const updates = pickAllowedFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    if (!validateAssetId(updates.asset)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    const updated = await Maintenance.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true })
      .populate('asset')
      .lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Maintenance record not found' });

    return res.status(200).json({ success: true, message: 'Maintenance record updated successfully', data: updated });
  } catch (err) {
    console.error('updateMaintenance error:', err);
    return handleMaintenanceError(res, err, 'Failed to update maintenance record');
  }
};

// Delete one maintenance record by MongoDB ID.
const deleteMaintenance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid maintenance ID' });
    }

    const deleted = await Maintenance.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Maintenance record not found' });

    return res.status(200).json({ success: true, message: 'Maintenance record deleted successfully', data: deleted });
  } catch (err) {
    console.error('deleteMaintenance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete maintenance record', error: err.message });
  }
};

module.exports = {
  addMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  updateMaintenance,
  deleteMaintenance,
};
