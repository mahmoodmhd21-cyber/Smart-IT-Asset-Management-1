const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const appRoot = process.env.QA_APP_ROOT || root;
const runId = Date.now().toString();
const database = `smart_it_qa_${runId}`;
let mongoUri;
let mongo;
const output = path.join(root, 'artifacts', 'qa', runId);
fs.mkdirSync(output, { recursive: true });
const state = {
  runId, database, output,
  api: 'http://127.0.0.1:5301/api',
  frontend: 'http://127.0.0.1:3301',
  email: `qa-admin-${runId}@example.test`,
  password: randomBytes(20).toString('hex'),
};
fs.writeFileSync('/tmp/smart-it-qa-state.json', JSON.stringify(state), { mode: 0o600 });

const children = [];
function start(command, args, cwd, env, logName) {
  const log = fs.openSync(path.join(output, logName), 'w');
  const child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, detached: true,
    stdio: ['ignore', log, log],
  });
  children.push(child);
  return child;
}

let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  for (const child of children) {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      process.kill(-child.pid, 'SIGTERM');
      await exited;
    }
  }
  const mongoose = require(path.join(appRoot, 'node_modules/mongoose'));
  try {
    // Drop only the database created by this specific disposable audit run.
    if (!/^smart_it_qa_\d+$/.test(database)) throw new Error('Unexpected QA database name');
    if (!mongoUri) return;
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.dropDatabase();
    console.log(`Removed disposable database ${database}; stopped both QA servers.`);
  } catch (error) {
    console.error(`QA cleanup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    process.stdin.pause();
  }
}

process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);

async function waitReady(url) {
  const deadline = Date.now() + 110000;
  while (Date.now() < deadline) {
    if (children.some((child) => child.exitCode !== null)) throw new Error('A QA server exited before becoming ready');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`QA server did not become ready: ${url}`);
}

async function main() {
  mongo = await require('./mongo-fixture.cjs').startMongo();
  mongoUri = mongo.uri(database);
  state.mongoUri = mongoUri;
  fs.writeFileSync('/tmp/smart-it-qa-state.json', JSON.stringify(state), { mode: 0o600 });
  // Seed the disposable first admin locally; public registration is forbidden.
  const mongoose = require(path.join(appRoot, 'node_modules/mongoose'));
  const bcrypt = require(path.join(appRoot, 'node_modules/bcryptjs'));
  const User = require(path.join(appRoot, 'models/User'));
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
  await User.create({ fullName: 'QA Administrator', email: state.email,
    password: await bcrypt.hash(state.password, 10), role: 'Admin' });
  await mongoose.disconnect();
  start(process.execPath, ['server.js'], appRoot, {
    PORT: '5301', MONGO_URI: mongoUri,
    JWT_SECRET: randomBytes(40).toString('hex'),
    QR_PUBLIC_BASE_URL: 'http://127.0.0.1:5301',
  }, 'api.log');
  start(process.execPath, [path.join(__dirname, 'vite-server.cjs')], root,
    { QA_APP_ROOT: appRoot }, 'vite.log');
  await Promise.all([waitReady(state.api.replace(/\/api$/, '/')), waitReady(state.frontend)]);
  console.log(`QA environment ready. Disposable database: ${database}. Results: ${output}`);
  process.stdin.resume();
  process.stdin.once('data', cleanup);
}

main().catch(async (error) => {
  console.error(error.message);
  await cleanup();
  process.exitCode = 1;
});
