const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const lifecycle = require('../services/assetLifecycle');

// Every write shares the same transactional rules, including QR status edits.
exports.addAsset = async (req, res) => {
  try {
    return res.status(201).json({ success: true, data: await lifecycle.createAsset(req.body) });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.getAllAssets = async (req, res) => {
  try {
    return res.json({ success: true, data: await Asset.find().lean() });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch assets.' });
  }
};

exports.getAssetById = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid asset ID.' });
    const asset = await Asset.findById(req.params.id).lean();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    return res.json({ success: true, data: asset });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to fetch asset.' });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    return res.json({ success: true, data: await lifecycle.updateAsset(req.params.id, req.body) });
  } catch (error) { return lifecycle.sendError(res, error); }
};

exports.deleteAsset = async (req, res) => {
  try {
    const data = await lifecycle.deleteAsset(req.params.id);
    return res.json({ success: true, message: 'Asset deleted successfully', data });
  } catch (error) { return lifecycle.sendError(res, error); }
};
