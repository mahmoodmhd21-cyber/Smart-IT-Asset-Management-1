/**
 * Asset Controller
 * Manages CRUD operations for IT assets.
 *
 * Functions:
 * - addAsset: Create a new asset
 * - getAllAssets: Retrieve all assets
 * - getAssetById: Retrieve a single asset by ID
 * - updateAsset: Update allowed fields of an asset
 * - deleteAsset: Remove an asset
 *
 * Assumes a Mongoose model named `Asset` exists at ../models/Asset
 */

const mongoose = require('mongoose');
const Asset = require('../models/Asset');

// Create a new asset record
exports.addAsset = async (req, res) => {
  try {
    // Expecting asset details in req.body
    const payload = req.body;

    const asset = new Asset(payload);
    const saved = await asset.save();

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('addAsset error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create asset', error: err.message });
  }
};

// Retrieve every asset stored in the MongoDB database
exports.getAllAssets = async (req, res) => {
  try {
    const assets = await Asset.find().lean();
    return res.status(200).json({ success: true, data: assets });
  } catch (err) {
    console.error('getAllAssets error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch assets', error: err.message });
  }
};

// Retrieve a single asset by ID
exports.getAssetById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    const asset = await Asset.findById(id).lean();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    return res.status(200).json({ success: true, data: asset });
  } catch (err) {
    console.error('getAssetById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch asset', error: err.message });
  }
};

// Update allowed fields of an asset
exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    // Only allow specific fields to be updated
    const allowed = ['assetName', 'status', 'location', 'category', 'brand', 'model', 'purchaseDate'];
    const updates = {};
    Object.keys(req.body).forEach((k) => {
      if (allowed.includes(k)) updates[k] = req.body[k];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await Asset.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Asset not found' });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('updateAsset error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update asset', error: err.message });
  }
};

// Delete an asset by its unique MongoDB ID
exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asset ID'
      });
    }

    // TODO:
    // Before deleting an asset, verify that it is not currently allocated.
    // Once the Allocation model is implemented, query the Allocations
    // collection for an active allocation associated with this asset.
    // If an active allocation exists, return HTTP 409 (Conflict) and
    // prevent the asset from being deleted.

    // Delete the asset from the database
    const removed = await Asset.findByIdAndDelete(id).lean();

    // Return an error if the asset does not exist
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Return a successful response with the deleted asset details
    return res.status(200).json({
      success: true,
      message: 'Asset deleted successfully',
      data: removed
    });
  } catch (err) {
    console.error('deleteAsset error:', err.message);

    return res.status(500).json({
      success: false,
      message: 'Failed to delete asset',
      error: err.message
    });
  }
};