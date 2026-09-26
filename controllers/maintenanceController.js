const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');
const lifecycle = require('../services/assetLifecycle');

// Maintenance and its linked asset statuses commit or roll back together.
exports.addMaintenance = async (req, res) => {
  try {
    return res.status(201).json({ success: true, data: await lifecycle.changeMaintenance(null, req.body) });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.getAllMaintenance = async (req, res) => {
  try {
    return res.json({ success: true, data: await Maintenance.find().populate('asset').lean() });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance records.' });
  }
};

exports.getMaintenanceById = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid maintenance ID.' });
    const data = await Maintenance.findById(req.params.id).populate('asset').lean();
    if (!data) return res.status(404).json({ success: false, message: 'Maintenance record not found.' });
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance record.' });
  }
};

exports.updateMaintenance = async (req, res) => {
  try {
    const data = await lifecycle.changeMaintenance(req.params.id, req.body);
    return res.json({ success: true, message: 'Maintenance record updated successfully', data });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.deleteMaintenance = async (req, res) => {
  try {
    const data = await lifecycle.changeMaintenance(req.params.id, {}, true);
    return res.json({ success: true, message: 'Maintenance record deleted successfully', data });
  } catch (error) { return lifecycle.sendError(res, error); }
};
