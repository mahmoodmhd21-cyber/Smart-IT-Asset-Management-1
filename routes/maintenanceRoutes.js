const express = require("express");
const router = express.Router();

const {
    addMaintenance,
    getAllMaintenance,
    getMaintenanceById,
    updateMaintenance,
    deleteMaintenance
} = require("../controllers/maintenanceController");

// Create a maintenance record
router.post("/", addMaintenance);

// Retrieve all maintenance records
router.get("/", getAllMaintenance);

// Retrieve one maintenance record
router.get("/:id", getMaintenanceById);

// Update a maintenance record
router.put("/:id", updateMaintenance);

// Delete a maintenance record
router.delete("/:id", deleteMaintenance);

module.exports = router;