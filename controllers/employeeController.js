/**
 * Employee Controller
 * Manages CRUD operations for Employee entities.
 */

const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Allocation = require('../models/Allocation');
const transaction = require('../services/transaction');
const { LifecycleError } = require('../services/assetStatusPolicy');

function handleEmployeeError(res, err) {
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'Employee ID or email already exists.' });
  if (['ValidationError', 'CastError'].includes(err.name)) return res.status(400).json({ success: false, message: err.message });
  return res.status(500).json({ success: false, message: 'Could not update employee.' });
}

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

    const updated = await transaction(async session => {
      const employee = await Employee.findByIdAndUpdate(id, { $inc: { lifecycleVersion: 1 } }, { session, returnDocument: 'after' });
      if (!employee) return null;
      if (updates.status === 'Inactive' && await Allocation.exists({ employee: id, allocationStatus: 'Allocated' }).session(session)) {
        throw new LifecycleError(409, 'Return active allocations before deactivating this employee.');
      }
      Object.assign(employee, updates);
      await employee.save({ session });
      return employee;
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('updateEmployee error:', err);
    return handleEmployeeError(res, err);
  }
};

// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const deleted = await transaction(async session => {
      // Allocation creation writes this same document, so delete/allocation races retry safely.
      const employee = await Employee.findByIdAndUpdate(id, { $inc: { lifecycleVersion: 1 } }, { session, returnDocument: 'after' });
      if (!employee) return null;
      if (await Allocation.exists({ employee: id }).session(session)) {
        throw new LifecycleError(409, 'Cannot delete an employee with allocation history. Deactivate them instead.');
      }
      await employee.deleteOne({ session });
      return employee;
    });
    if (!deleted) return res.status(404).json({ success: false, message: 'Employee not found' });

    return res.status(200).json({ success: true, data: deleted });
  } catch (err) {
    console.error('deleteEmployee error:', err);
    return handleEmployeeError(res, err);
  }
};

// Operational staff need an assignee picker, not access to the admin employee directory.
const getAssignees = async (req, res) => {
  try {
    const employees = await Employee.find({ status: 'Active' }).select('_id fullName employeeId').lean();
    return res.json({ success: true, data: employees });
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load employees.' });
  }
};

module.exports = {
  getAssignees,
  addEmployee,
  getAllEmployees,
  getEmployeeById,
  viewAllEmployees: getAllEmployees,
  viewEmployeeById: getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
