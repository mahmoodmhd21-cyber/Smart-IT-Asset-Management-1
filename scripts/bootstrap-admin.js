// Local-only first-account setup. Never expose bootstrap through an HTTP route.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('../config/auth');

async function main() {
  const { MONGO_URI, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = process.env;
  if (!MONGO_URI || !BOOTSTRAP_ADMIN_NAME?.trim() ||
      !/^\S+@\S+\.\S+$/.test(BOOTSTRAP_ADMIN_EMAIL || '') ||
      !BOOTSTRAP_ADMIN_PASSWORD || BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
    throw new Error('Set MONGO_URI and BOOTSTRAP_ADMIN_NAME, EMAIL and PASSWORD (12+ characters).');
  }
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  if (await User.exists({})) throw new Error('Bootstrap refused: accounts already exist. Use an existing administrator.');
  // A fixed first-account ID also prevents two simultaneous bootstrap runs.
  await User.create({
    _id: '000000000000000000000001',
    fullName: BOOTSTRAP_ADMIN_NAME.trim(),
    email: BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
    password: await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 12),
    role: 'Admin',
  });
  console.log('First administrator created. Remove bootstrap credentials from the environment.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
