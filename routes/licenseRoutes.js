const express = require("express");
const router = express.Router();

const {
    addLicense,
    getAllLicenses,
    getLicenseById,
    updateLicense,
    deleteLicense
} = require("../controllers/licenseController");

// Create a new software license
router.post("/", addLicense);

// Retrieve all software licenses
router.get("/", getAllLicenses);

// Retrieve one software license
router.get("/:id", getLicenseById);

// Update a software license
router.put("/:id", updateLicense);

// Delete a software license
router.delete("/:id", deleteLicense);

module.exports = router;