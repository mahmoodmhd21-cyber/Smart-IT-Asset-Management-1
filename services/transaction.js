const mongoose = require('mongoose');
const { LifecycleError } = require('./assetStatusPolicy');

// Shared transaction boundary; callbacks must pass the session to every DB operation.
module.exports = async function transaction(work) {
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw new LifecycleError(503, 'Changes require a MongoDB replica set.');
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      readPreference: 'primary', maxCommitTimeMS: 5000,
    });
  } finally { await session.endSession(); }
};
