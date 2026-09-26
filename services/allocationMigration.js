const mongoose = require('mongoose');
const Allocation = require('../models/Allocation');
const Employee = require('../models/Employee');
const User = require('../models/User');
const transaction = require('./transaction');

// Never guess using names. Explicit mappings override only unique normalized-email matches.
async function candidate(record, mappings, session) {
  if (mappings[String(record._id)]) {
    const id = mappings[String(record._id)];
    if (!mongoose.isObjectIdOrHexString(id)) return { reason: 'Invalid mapped employee ID' };
    const employee = await Employee.findById(id).session(session);
    return employee ? { employee } : { reason: 'Mapped employee not found' };
  }
  const user = await User.findById(record.user).session(session);
  const email = user?.email?.trim().toLowerCase();
  if (!email) return { reason: 'Legacy account or email not found' };
  const employees = await Employee.find().session(session);
  const matches = employees.filter(employee => employee.email?.trim().toLowerCase() === email);
  return matches.length === 1 ? { employee: matches[0] } : { reason: 'No unique employee email match' };
}

async function migrate({ apply = false, mappings = {} } = {}) {
  if (!mappings || Array.isArray(mappings) || typeof mappings !== 'object') throw new Error('Mappings must be an allocation-ID to employee-ID object.');
  const records = await Allocation.find({ employee: null, user: { $ne: null } }).lean();
  const report = { mapped: [], unresolved: [] };
  for (const record of records) {
    const inspect = async session => {
      const current = await Allocation.findById(record._id).session(session);
      if (!current || current.employee) return;
      const result = await candidate(current, mappings, session);
      if (!result.employee) return { allocation: String(current._id), reason: result.reason };
      if (current.allocationStatus === 'Allocated' && result.employee.status !== 'Active') {
        return { allocation: String(current._id), reason: 'Return assignment or activate mapped employee first' };
      }
      if (apply) {
        // Coordinate with employee deletion/deactivation and preserve the original user reference.
        const target = await Employee.findByIdAndUpdate(result.employee._id, { $inc: { lifecycleVersion: 1 } }, { session });
        if (!target) throw new Error('Mapped employee disappeared; rerun migration.');
        current.employee = result.employee._id;
        await current.save({ session });
      }
      return { allocation: String(current._id), employee: String(result.employee._id) };
    };
    const result = apply ? await transaction(inspect) : await inspect(null);
    if (result) report[result.reason ? 'unresolved' : 'mapped'].push(result);
  }
  return report;
}

module.exports = { migrate };
