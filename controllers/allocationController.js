const mongoose = require('mongoose');
const Allocation = require('../models/Allocation');
const lifecycle = require('../services/assetLifecycle');

exports.allocateAsset = async (req, res) => {
  try {
    return res.status(201).json({ success: true, data: await lifecycle.allocate(req.body) });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.getAllAllocations = async (req, res) => {
  try {
    const data = await Allocation.find().populate('asset').populate('employee', '_id fullName employeeId email status').populate('user', '_id fullName email role').lean();
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch allocations.' });
  }
};

exports.getAllocationById = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid allocation ID.' });
    const data = await Allocation.findById(req.params.id).populate('asset').populate('employee', '_id fullName employeeId email status').populate('user', '_id fullName email role').lean();
    if (!data) return res.status(404).json({ success: false, message: 'Allocation not found.' });
    return res.json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch allocation.' });
  }
};

exports.returnAsset = async (req, res) => {
  try {
    return res.json({ success: true, data: await lifecycle.changeAllocation(req.params.id, req.body) });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.deleteAllocation = async (req, res) => {
  try {
    const data = await lifecycle.changeAllocation(req.params.id, {}, true);
    return res.json({ success: true, message: 'Allocation deleted successfully', data });
  } catch (error) { return lifecycle.sendError(res, error); }
};
