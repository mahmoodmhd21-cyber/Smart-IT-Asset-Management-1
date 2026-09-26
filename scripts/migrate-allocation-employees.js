require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const mongoose = require('mongoose');
const { migrate } = require('../services/allocationMigration');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  const mapIndex = process.argv.indexOf('--map');
  const mappings = mapIndex === -1 ? {} : JSON.parse(fs.readFileSync(process.argv[mapIndex + 1], 'utf8'));
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify({ apply, ...await migrate({ apply, mappings }) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
