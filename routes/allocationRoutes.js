const express = require('express');
const {
  allocateAsset,
  getAllAllocations,
  getAllocationById,
  returnAsset,
  deleteAllocation,
} = require('../controllers/allocationController');

const router = express.Router();

/**
 * Allocation Routes
 * Defines allocation endpoints and connects them to the allocation controller.
 *
 * Routes:
 * - POST / -> Allocate an asset to a user
 * - GET / -> Retrieve all allocations
 * - GET /:id -> Retrieve one allocation by ID
 * - PATCH /:id/return -> Mark an allocation as returned
 * - DELETE /:id -> Delete an allocation record
 */

// Assign an asset to a user
router.post('/', allocateAsset);

// Fetch all allocation records
router.get('/', getAllAllocations);

// Fetch one allocation by ID
router.get('/:id', getAllocationById);

// Mark an asset allocation as returned
router.patch('/:id/return', returnAsset);

// Delete an allocation record
router.delete('/:id', deleteAllocation);

module.exports = router;
