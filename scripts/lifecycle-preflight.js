require('dotenv').config();
const mongoose = require('mongoose');
const Allocation = require('../models/Allocation');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('Transactions require a replica set or sharded cluster. No records were changed.');
  }
  const duplicates = await Allocation.aggregate([
    { $match: { allocationStatus: 'Allocated' } },
    { $group: { _id: '$asset', records: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  if (duplicates.length) {
    console.error(JSON.stringify(duplicates, null, 2));
    throw new Error('Duplicate active allocations found. Review these records before creating the index; nothing was deleted.');
  }
  if (process.argv.includes('--apply')) {
    await Allocation.createIndexes();
    console.log('Unique active-allocation index is ready. No allocation records were changed.');
  } else console.log('Preflight passed. Run again with --apply to create the unique index.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
