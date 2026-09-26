class LifecycleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Retirement is sticky; unfinished work takes priority over an assignment.
function derivedStatus(asset, { openMaintenance, activeAllocation }) {
  if (asset.status === 'Retired') return 'Retired';
  if (asset.maintenanceHold || openMaintenance) return 'Maintenance';
  return activeAllocation ? 'Allocated' : 'Available';
}

function manualStatus(asset, status, facts) {
  if (!['Available', 'Allocated', 'Maintenance', 'Retired'].includes(status)) {
    throw new LifecycleError(400, 'Invalid asset status.');
  }
  if (status === 'Available' || status === 'Allocated') {
    if (facts.openMaintenance) throw new LifecycleError(409, 'Cannot release an asset with unfinished maintenance.');
    if (status === 'Available' && facts.activeAllocation) {
      throw new LifecycleError(409, 'Return the active allocation before marking this asset available.');
    }
    if (status === 'Allocated' && !facts.activeAllocation) {
      throw new LifecycleError(409, 'Create an allocation to assign this asset.');
    }
  }
  if (status === 'Retired' && facts.activeAllocation) {
    throw new LifecycleError(409, 'Return the active allocation before retiring this asset.');
  }
  return { status, maintenanceHold: status === 'Maintenance' && !facts.openMaintenance };
}

module.exports = { LifecycleError, derivedStatus, manualStatus };
