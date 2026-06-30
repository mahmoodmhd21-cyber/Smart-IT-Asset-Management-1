/**
 * Allocation Controller
 * Manages employee allocations of IT assets and related workflows.
 *
 * Functions:
 * - allocateAsset: Assign an asset to a user
 * - getAllAllocations: Retrieve all allocation records
 * - getAllocationById: Retrieve a specific allocation by ID
 * - returnAsset: Mark an asset as returned and update asset availability
 * - deleteAllocation: Remove an allocation record
 *
 * Assumes Mongoose models named `Allocation`, `Asset`, and `User`
 * exist at ../models/Allocations, ../models/Assets, and ../models/User.
 */

const mongoose = require('mongoose');
const Allocation = require('../models/Allocation');
const Asset = require('../models/Asset');
const User = require('../models/User');

// Allocate an asset to a user and update asset availability
exports.allocateAsset = async (req, res) => {
  try {
    const { assetId, userId, allocationDate, remarks } = req.body;

    if (!assetId || !userId) {
      return res.status(400).json({ success: false, message: 'assetId and userId are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(assetId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid assetId or userId.' });
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    if (asset.status !== 'Available') {
      return res.status(409).json({ success: false, message: 'Asset is not available for allocation.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const existingAllocation = await Allocation.findOne({ asset: assetId, allocationStatus: 'Allocated' });
    if (existingAllocation) {
      return res.status(409).json({ success: false, message: 'Asset is already allocated.' });
    }

    const allocation = new Allocation({
      asset: assetId,
      user: userId,
      allocationDate: allocationDate ? new Date(allocationDate) : new Date(),
      returnDate: null,
      allocationStatus: 'Allocated',
      remarks: remarks || '',
    });
    
    const savedAllocation = await allocation.save();
    await Asset.findByIdAndUpdate(assetId, { status: 'Allocated' }); // In production, these operations should be executed inside a MongoDB transaction to ensure consistency.

    return res.status(201).json({ success: true, data: savedAllocation });
  } catch (error) {
    console.error('allocateAsset error:', error);
    return res.status(500).json({ success: false, message: 'Failed to allocate asset', error: error.message });
  }
};

// Retrieve every allocation record
exports.getAllAllocations = async (req, res) => {
  try {
    const allocations = await Allocation.find()
      .populate('asset')
      .populate('user')
      .lean();

    return res.status(200).json({ success: true, data: allocations });
  } catch (error) {
    console.error('getAllAllocations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch allocations', error: error.message });
  }
};

// Retrieve details of a specific allocation by ID
exports.getAllocationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid allocation ID' });
    }

    const allocation = await Allocation.findById(id)
      .populate('asset')
      .populate('user')
      .lean();

    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    return res.status(200).json({ success: true, data: allocation });
  } catch (error) {
    console.error('getAllocationById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch allocation', error: error.message });
  }
};

// Mark an allocation as returned and update the associated asset availability
exports.returnAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnDate, remarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid allocation ID' });
    }

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    if (allocation.allocationStatus === 'Returned') {
      return res.status(400).json({ success: false, message: 'Asset has already been returned.' });
    }

    allocation.returnDate = returnDate ? new Date(returnDate) : new Date();
    allocation.allocationStatus = 'Returned';
    if (remarks) {
      allocation.remarks = remarks;
    }

    const returnedAllocation = await allocation.save();
    await Asset.findByIdAndUpdate(allocation.asset, { status: 'Available' });

    return res.status(200).json({ success: true, data: returnedAllocation });
  } catch (error) {
    console.error('returnAsset error:', error);
    return res.status(500).json({ success: false, message: 'Failed to return asset', error: error.message });
  }
};

// Delete an allocation record and restore asset availability when needed
exports.deleteAllocation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid allocation ID' });
    }

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ success: false, message: 'Allocation not found' });
    }

    if (allocation.allocationStatus === 'Allocated') {
      await Asset.findByIdAndUpdate(allocation.asset, { status: 'Available' });
    }

    const deletedAllocation = await Allocation.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: 'Allocation deleted successfully',
        data: deletedAllocation
    });
  } catch (error) {
    console.error('deleteAllocation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete allocation', error: error.message });
  }
};
