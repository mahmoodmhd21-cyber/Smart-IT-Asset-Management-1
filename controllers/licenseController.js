const mongoose = require('mongoose');
const License = require('../models/License');

// Fields that are allowed to be created or updated through the API.
const allowedFields = [
  'softwareName',
  'licenseKey',
  'vendor',
  'purchaseDate',
  'expiryDate',
  'numberOfSeats',
  'assignedSeats',
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

// Extract the duplicate field name from a MongoDB duplicate-key error.
const getDuplicateField = (error) => Object.keys(error.keyPattern || error.keyValue || {})[0];

// Convert common Mongoose/MongoDB errors into consistent API responses.
const handleLicenseError = (res, err, fallbackMessage) => {
  if (err.code === 11000) {
    const field = getDuplicateField(err) || 'field';
    return res.status(409).json({
      success: false,
      message: `License with this ${field} already exists`,
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((error) => error.message).join(', '),
    });
  }

  return res.status(500).json({ success: false, message: fallbackMessage, error: err.message });
};

// Add a new software license.
const addLicense = async (req, res) => {
  try {
    const license = await License.create(pickAllowedFields(req.body));
    return res.status(201).json({ success: true, data: license });
  } catch (err) {
    console.error('addLicense error:', err);
    return handleLicenseError(res, err, 'Failed to create license');
  }
};

// Retrieve all software licenses.
const getAllLicenses = async (req, res) => {
  try {
    const licenses = await License.find().lean();
    return res.status(200).json({ success: true, data: licenses });
  } catch (err) {
    console.error('getAllLicenses error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch licenses', error: err.message });
  }
};

// Retrieve one software license by MongoDB ID.
const getLicenseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid license ID' });
    }

    const license = await License.findById(id).lean();
    if (!license) return res.status(404).json({ success: false, message: 'License not found' });

    return res.status(200).json({ success: true, data: license });
  } catch (err) {
    console.error('getLicenseById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch license', error: err.message });
  }
};

// Update allowed fields for one software license.
const updateLicense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid license ID' });
    }

    const updates = pickAllowedFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await License.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'License not found' });

    return res.status(200).json({ success: true, message: 'License updated successfully', data: updated });
  } catch (err) {
    console.error('updateLicense error:', err);
    return handleLicenseError(res, err, 'Failed to update license');
  }
};

// Delete one software license by MongoDB ID.
const deleteLicense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid license ID' });
    }

    const deleted = await License.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'License not found' });

    return res.status(200).json({ success: true, message: 'License deleted successfully', data: deleted });
  } catch (err) {
    console.error('deleteLicense error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete license', error: err.message });
  }
};

module.exports = {
  addLicense,
  getAllLicenses,
  getLicenseById,
  updateLicense,
  deleteLicense,
};
