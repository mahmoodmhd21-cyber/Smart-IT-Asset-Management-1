const express = require("express");
const router = express.Router();

const {
    addEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee
} = require("../controllers/employeeController");

// Create a new employee
router.post("/", addEmployee);

// Retrieve all employees
router.get("/", getAllEmployees);

// Retrieve a single employee by ID
router.get("/:id", getEmployeeById);

// Update an employee
router.put("/:id", updateEmployee);

// Delete an employee
router.delete("/:id", deleteEmployee);

module.exports = router;