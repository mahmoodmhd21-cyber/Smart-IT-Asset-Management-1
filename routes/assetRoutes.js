const express = require('express');
const {
  addAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
} = require('../controllers/assetController');
const { protect } = require("../middleware/authMiddleware");


const router = express.Router();

/**
 * Asset Routes
 * Defines asset-related endpoints and connects them to the asset controller.
 *
 * Routes:
 * - POST / -> Create an asset
 * - GET / -> Retrieve all assets
 * - GET /:id -> Retrieve a specific asset
 * - PUT /:id -> Update an asset
 * - DELETE /:id -> Delete an asset
 */

// Create a new asset record
router.post('/', addAsset);

// Get all asset records
router.get('/', protect, getAllAssets);

// Get a specific asset by ID
router.get('/:id', getAssetById);

// Update a specific asset by ID
router.put('/:id', updateAsset);

// Delete a specific asset by ID
router.delete('/:id', deleteAsset);

module.exports = router;
