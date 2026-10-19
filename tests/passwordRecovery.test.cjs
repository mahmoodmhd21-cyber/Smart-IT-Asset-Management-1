const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(process.env.QA_APP_ROOT || path.join(__dirname, '..'));
const bcrypt = require(path.join(root, 'node_modules/bcryptjs'));
const { resetPassword } = require(path.join(root, 'scripts/reset-password.js'));

function fixture(user, modifiedCount = 1) {
  const calls = [];
  return { calls, User: {
    findOne(filter) { calls.push(['find', filter]); return { select: async () => user }; },
    async updateOne(...args) { calls.push(['update', ...args]); return { modifiedCount }; },
  } };
}

test('recovery hashes once, preserves identity and revokes sessions atomically', async () => {
  const { User, calls } = fixture({ _id: 'existing-id', password: 'old-hash', isActive: true });
  const password = 'Temporary test password 2026!';
  await resetPassword(User, ' Demo@Example.com ', password);
  assert.deepEqual(calls[0], ['find', { email: 'demo@example.com' }]);
  const [, filter, update] = calls[1];
  assert.deepEqual(filter, { _id: 'existing-id', password: 'old-hash', isActive: { $ne: false } });
  assert.deepEqual(Object.keys(update.$set), ['password']);
  assert.equal(await bcrypt.compare(password, update.$set.password), true);
  assert.deepEqual(update.$inc, { tokenVersion: 1 });
});

test('invalid password or email cannot touch the database', async () => {
  for (const [email, password] of [['demo@example.com', 'too-short'], ['bad-email', 'Long test password'], ['demo@example.com', 'x'.repeat(73)]]) {
    const { User, calls } = fixture(null);
    await assert.rejects(resetPassword(User, email, password));
    assert.equal(calls.length, 0);
  }
});

test('missing and disabled accounts are never created or enabled', async () => {
  for (const user of [null, { isActive: false }]) {
    const { User, calls } = fixture(user);
    await assert.rejects(resetPassword(User, 'demo@example.com', 'Long test password'));
    assert.equal(calls.filter(call => call[0] === 'update').length, 0);
  }
});

test('concurrent changes do not report a successful reset', async () => {
  const { User } = fixture({ _id: 'existing-id', password: 'old-hash' }, 0);
  await assert.rejects(resetPassword(User, 'demo@example.com', 'Long test password'), /changed during recovery/);
});
