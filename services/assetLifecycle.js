const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Allocation = require('../models/Allocation');
const Maintenance = require('../models/Maintenance');
const Employee = require('../models/Employee');
const databaseTransaction = require('./transaction');
const QRCode = require('../models/QRCode');
const { LifecycleError, derivedStatus, manualStatus } = require('./assetStatusPolicy');

const assetFields = ['assetName', 'location', 'category', 'brand', 'model', 'serialNumber', 'purchaseDate', 'status'];
const maintenanceFields = ['asset', 'maintenanceType', 'description', 'serviceProvider', 'maintenanceDate', 'nextMaintenanceDate', 'cost', 'status'];
const pick = (body, fields) => Object.fromEntries(fields.filter(key => body?.[key] !== undefined).map(key => [key, body[key]]));
const openStatuses = ['Scheduled', 'In Progress'];
let indexReady;
let serialIndexReady;

async function ensureSerialIndex() {
  // Refuse serial writes if existing duplicates prevent the uniqueness guard.
  if (!serialIndexReady) serialIndexReady = Asset.createIndexes().catch(() => {
    serialIndexReady = undefined;
    throw new LifecycleError(503, 'Serial-number index is unavailable. Resolve duplicate serial numbers before editing inventory.');
  });
  await serialIndexReady;
}

function validId(id, name = 'asset') {
  if (!mongoose.isObjectIdOrHexString(id)) throw new LifecycleError(400, `Invalid ${name} ID.`);
}

async function ensureAllocationIndex() {
  // Do not silently operate without the database-level double-booking guard.
  if (!indexReady) {
    indexReady = Allocation.createIndexes().catch(() => {
      indexReady = undefined;
      throw new LifecycleError(503, 'Allocation index is unavailable. Resolve duplicate active allocations and run the lifecycle preflight.');
    });
  }
  await indexReady;
}

async function transaction(work) {
  await ensureAllocationIndex();
  return databaseTransaction(work);
}

async function lockAssets(ids, session) {
  const assets = new Map();
  // A real write to each shared asset makes concurrent lifecycle transactions conflict,
  // even when the displayed status would not change (for example a second repair).
  for (const id of [...new Set(ids.map(String))].sort()) {
    validId(id);
    const asset = await Asset.findByIdAndUpdate(id, { $inc: { lifecycleVersion: 1 } },
      { session, returnDocument: 'after' });
    if (!asset) throw new LifecycleError(404, 'Asset not found.');
    assets.set(id, asset);
  }
  return assets;
}

async function facts(assetId, session) {
  // Parallel operations are not supported within a MongoDB transaction.
  const openMaintenance = !!await Maintenance.exists({ asset: assetId, status: { $in: openStatuses } }).session(session);
  const activeAllocation = !!await Allocation.exists({ asset: assetId, allocationStatus: 'Allocated' }).session(session);
  return { openMaintenance, activeAllocation };
}

async function reconcile(asset, session) {
  asset.status = derivedStatus(asset, await facts(asset._id, session));
  await asset.save({ session });
  return asset;
}

async function createAsset(body) {
  const payload = pick(body, assetFields);
  normalizeSerial(payload);
  await ensureSerialIndex();
  const initialState = manualStatus({}, payload.status === undefined ? 'Available' : payload.status, {});
  return transaction(async session => {
    const asset = new Asset({ ...payload, ...initialState });
    await asset.save({ session });
    await QRCode.create([{ asset: asset._id }], { session });
    return asset;
  });
}

async function updateAsset(id, body) {
  validId(id);
  const updates = pick(body, assetFields);
  normalizeSerial(updates);
  if (Object.hasOwn(updates, 'serialNumber')) await ensureSerialIndex();
  if (!Object.keys(updates).length) throw new LifecycleError(400, 'No valid fields to update.');
  return transaction(async session => {
    const asset = (await lockAssets([id], session)).get(String(id));
    if (updates.status !== undefined) Object.assign(updates, manualStatus(asset, updates.status, await facts(id, session)));
    Object.assign(asset, updates);
    await asset.save({ session });
    return asset;
  });
}

function normalizeSerial(values) {
  if (!Object.hasOwn(values, 'serialNumber')) return;
  if (values.serialNumber !== null && typeof values.serialNumber !== 'string') {
    throw new LifecycleError(400, 'Serial number must be text.');
  }
  values.serialNumber = values.serialNumber?.trim() || undefined;
}

async function deleteAsset(id) {
  validId(id);
  return transaction(async session => {
    const asset = (await lockAssets([id], session)).get(String(id));
    // Retain referenced inventory; deleting history requires an explicit retention policy.
    if (await Allocation.exists({ asset: id }).session(session) || await Maintenance.exists({ asset: id }).session(session)) {
      throw new LifecycleError(409, 'Cannot delete an asset with allocation or maintenance history. Retire it instead.');
    }
    await QRCode.deleteOne({ asset: id }, { session });
    await Asset.deleteOne({ _id: id }, { session });
    return asset;
  });
}

async function allocate(body) {
  const { assetId, employeeId, allocationDate, remarks } = body || {};
  if (body?.userId !== undefined) throw new LifecycleError(400, 'New allocations require employeeId, not a login account.');
  validId(assetId); validId(employeeId, 'employee');
  return transaction(async session => {
    const asset = (await lockAssets([assetId], session)).get(String(assetId));
    const state = await facts(assetId, session);
    if (asset.status !== 'Available' || asset.maintenanceHold || state.openMaintenance || state.activeAllocation) {
      throw new LifecycleError(409, 'Asset is not available for allocation.');
    }
    // This write conflicts with employee deletion/deactivation, preventing dangling assignees.
    const employee = await Employee.findOneAndUpdate({ _id: employeeId, status: 'Active' },
      { $inc: { lifecycleVersion: 1 } }, { session, returnDocument: 'after' });
    if (!employee) throw new LifecycleError(404, 'Active employee not found.');
    const allocation = new Allocation({ asset: assetId, employee: employeeId,
      allocationDate: allocationDate === undefined ? new Date() : allocationDate,
      allocationStatus: 'Allocated', returnDate: null, remarks: remarks || '' });
    await allocation.save({ session });
    await reconcile(asset, session);
    return allocation;
  });
}

async function changeAllocation(id, body, remove = false) {
  validId(id, 'allocation');
  return transaction(async session => {
    const allocation = await Allocation.findById(id).session(session);
    if (!allocation) throw new LifecycleError(404, 'Allocation not found.');
    const asset = (await lockAssets([allocation.asset], session)).get(String(allocation.asset));
    if (remove) await allocation.deleteOne({ session });
    else {
      if (allocation.allocationStatus !== 'Allocated') throw new LifecycleError(409, 'Allocation is not active.');
      allocation.returnDate = body?.returnDate === undefined ? new Date() : body.returnDate;
      allocation.allocationStatus = 'Returned';
      if (body?.remarks !== undefined) allocation.remarks = body.remarks;
      await allocation.save({ session });
    }
    await reconcile(asset, session);
    return allocation;
  });
}

async function changeMaintenance(id, body, remove = false) {
  if (id) validId(id, 'maintenance');
  const updates = pick(body, maintenanceFields);
  if (!remove && !Object.keys(updates).length) throw new LifecycleError(400, 'No valid fields to update.');
  if (updates.asset !== undefined) validId(updates.asset);
  return transaction(async session => {
    const record = id ? await Maintenance.findById(id).session(session) : new Maintenance(updates);
    if (!record) throw new LifecycleError(404, 'Maintenance record not found.');
    const oldAsset = record.asset;
    if (!remove) { Object.assign(record, updates); await record.validate(); }
    const assets = await lockAssets([oldAsset, record.asset], session);
    const target = assets.get(String(record.asset));
    if (!remove && openStatuses.includes(record.status)) {
      if (target.status === 'Retired') throw new LifecycleError(409, 'Reactivate this asset before opening maintenance.');
      // Once work is recorded it replaces a manual Maintenance reservation.
      target.maintenanceHold = false;
    }
    if (remove) await record.deleteOne({ session });
    else await record.save({ session });
    for (const asset of assets.values()) await reconcile(asset, session);
    const result = record.toObject();
    result.asset = target.toObject();
    return result;
  });
}

function sendError(res, error) {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.code === 11000) return res.status(409).json({ success: false, message: error.keyPattern?.serialNumber ? 'Serial number already exists.' : 'Asset already has an active allocation.' });
  if (error.code === 20 || error.codeName === 'IllegalOperation') {
    return res.status(503).json({ success: false, message: 'Asset changes require a MongoDB replica set. Run the lifecycle preflight.' });
  }
  console.error('Asset lifecycle failed:', error.message);
  return res.status(500).json({ success: false, message: 'Could not confirm the asset change. Refresh before retrying.' });
}

async function withAsset(id, work) {
  validId(id);
  return transaction(async session => {
    const asset = (await lockAssets([id], session)).get(String(id));
    return work(asset, session);
  });
}
module.exports = { createAsset, updateAsset, deleteAsset, allocate, changeAllocation, changeMaintenance, ensureAllocationIndex, sendError, withAsset };
