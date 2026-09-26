const express = require("express");
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

const {
    addEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    getAssignees
} = require("../controllers/employeeController");

router.get('/assignees', protect, authorize('Admin', 'IT Staff'), getAssignees);
router.use(protect, authorize('Admin'));

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
