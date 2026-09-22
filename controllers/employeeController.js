/**
 * Employee Controller
 * Manages CRUD operations for Employee entities.
 */

const mongoose = require('mongoose');
const Employee = require('../models/Employee');

const allowedFields = [
  'fullName',
  'employeeId',
  'email',
  'department',
  'designation',
  'phone',
  'status',
];

const getDuplicateField = (error) => Object.keys(error.keyPattern || error.keyValue || {})[0];

const pickAllowedFields = (body) => {
  const payload = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) payload[field] = body[field];
  });
  return payload;
};

// Add a new employee
const addEmployee = async (req, res) => {
  try {
    const employee = await Employee.create(pickAllowedFields(req.body));
    return res.status(201).json({ success: true, data: employee });
  } catch (err) {
    console.error('addEmployee error:', err);

    if (err.code === 11000) {
      const field = getDuplicateField(err) || 'field';
      return res.status(409).json({
        success: false,
        message: `Employee with this ${field} already exists`,
      });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors).map((error) => error.message).join(', '),
      });
    }

    return res.status(500).json({ success: false, message: 'Failed to create employee', error: err.message });
  }
};

// View all employees
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().lean();
    return res.status(200).json({ success: true, data: employees });
  } catch (err) {
    console.error('getAllEmployees error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', error: err.message });
  }
};

// View employee by MongoDB id
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(id).lean();
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.status(200).json({ success: true, data: employee });
  } catch (err) {
    console.error('getEmployeeById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch employee', error: err.message });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const updates = pickAllowedFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await Employee.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('updateEmployee error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update employee', error: err.message });
  }
};

// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const deleted = await Employee.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.status(200).json({ success: true, data: deleted });
  } catch (err) {
    console.error('deleteEmployee error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete employee', error: err.message });
  }
};

module.exports = {
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  viewAllEmployees: getAllEmployees,
  viewEmployeeById: getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
