// Operator-only recovery. Never expose this command through an HTTP endpoint.
const path = require('node:path');
const readline = require('node:readline');
const { Writable } = require('node:stream');
const bcrypt = require('bcryptjs');

async function resetPassword(User, email, password) {
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw new Error('Provide a valid account email.');
  }
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Use at least 12 characters and no more than 72 UTF-8 bytes.');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user) throw new Error('Account not found. No account was created.');
  if (user.isActive === false) throw new Error('Account is disabled. Recovery does not enable accounts.');
  const hash = await bcrypt.hash(password, 12);
  // Match the old hash so a concurrent recovery cannot silently overwrite another reset.
  const result = await User.updateOne(
    { _id: user._id, password: user.password, isActive: { $ne: false } },
    { $set: { password: hash }, $inc: { tokenVersion: 1 } },
    { runValidators: true }
  );
  if (result.modifiedCount !== 1) throw new Error('Account changed during recovery. Retry after checking its state.');
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const mongoose = require('mongoose');
  const User = require('../models/User');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run from an interactive terminal; password piping is disabled.');
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/reset-password.js account@example.com');
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required.');
  let target;
  try { target = new URL(uri); } catch { throw new Error('Invalid MONGO_URI configuration.'); }
  const email = process.argv[2].trim().toLowerCase();
  console.log(`Database host: ${target.hostname}\nDatabase: ${target.pathname.slice(1) || 'test'}\nAccount: ${email}`);
  console.log('This replaces the password and invalidates existing sessions. Other account fields are preserved.');

  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!hidden) process.stdout.write(chunk, encoding);
    done();
  } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  const ask = (prompt, secret = false) => new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    hidden = secret;
    const closed = () => { hidden = false; reject(new Error('Cancelled.')); };
    const cancelled = () => { rl.close(); };
    rl.once('close', closed);
    rl.once('SIGINT', cancelled);
    rl.question('', answer => {
      rl.removeListener('SIGINT', cancelled);
      rl.removeListener('close', closed);
      hidden = false;
      if (secret) process.stdout.write('\n');
      resolve(answer);
    });
  });
  try {
    if (await ask('Confirm this is the intended database. Type RESET to continue: ') !== 'RESET') {
      throw new Error('Cancelled. No password changed.');
    }
    const password = await ask('New password (hidden, 12+ characters): ', true);
    const confirmation = await ask('Repeat password (hidden): ', true);
    if (password !== confirmation) throw new Error('Passwords do not match. No password changed.');
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
    } catch { throw new Error('Database connection failed. Check the backend database configuration.'); }
    await resetPassword(User, email, password);
    console.log('Password updated. Existing sessions revoked. Sign in with the new password.');
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    // Driver errors can contain credential-bearing URIs; do not print their details.
    console.error(error.name === 'Error' ? error.message : 'Recovery failed. No success was confirmed.');
    process.exitCode = 1;
  });
}
module.exports = { resetPassword };
