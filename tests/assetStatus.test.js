const assert = require('node:assert/strict');
const { test } = require('node:test');
const { derivedStatus, manualStatus } = require('../services/assetStatusPolicy');

// Pure policy tests complement the real transactional controller tests.
for (const status of ['Available', 'Allocated', 'Maintenance', 'Retired']) {
  for (const openMaintenance of [false, true]) {
    for (const activeAllocation of [false, true]) {
      test(`${status}, open maintenance=${openMaintenance}, active allocation=${activeAllocation}`, () => {
        const expected = status === 'Retired' ? 'Retired' : openMaintenance ? 'Maintenance' : activeAllocation ? 'Allocated' : 'Available';
        assert.equal(derivedStatus({ status }, { openMaintenance, activeAllocation }), expected);
      });
    }
  }
}

test('manual maintenance hold survives automated return or completion', () => {
  assert.equal(derivedStatus({ status: 'Maintenance', maintenanceHold: true }, {}), 'Maintenance');
});
test('manual availability rejects unfinished work and active assignments', () => {
  for (const facts of [{ openMaintenance: true }, { activeAllocation: true }]) {
    assert.throws(() => manualStatus({}, 'Available', facts), { status: 409 });
  }
});
test('allocated status requires a real assignment and no unfinished maintenance', () => {
  assert.throws(() => manualStatus({}, 'Allocated', {}), { status: 409 });
  assert.throws(() => manualStatus({}, 'Allocated', { activeAllocation: true, openMaintenance: true }), { status: 409 });
  assert.equal(manualStatus({}, 'Allocated', { activeAllocation: true }).status, 'Allocated');
});
test('retirement requires returning the active allocation', () => {
  assert.throws(() => manualStatus({}, 'Retired', { activeAllocation: true }), { status: 409 });
});
test('manual maintenance only holds when there is no work record', () => {
  assert.equal(manualStatus({}, 'Maintenance', {}).maintenanceHold, true);
  assert.equal(manualStatus({}, 'Maintenance', { openMaintenance: true }).maintenanceHold, false);
});
test('explicit release clears a manual hold', () => {
  assert.deepEqual(manualStatus({ maintenanceHold: true }, 'Available', {}), { status: 'Available', maintenanceHold: false });
});
test('invalid status is rejected with 400', () => {
  assert.throws(() => manualStatus({}, 'Invalid', {}), { status: 400 });
});
