const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

// Own a separate mongod process and directory; never reconfigure the developer's DB.
exports.startMongo = async ({ replicaSet = true } = {}) => {
  const root = process.env.QA_APP_ROOT || path.resolve(__dirname, '../..');
  const { MongoClient } = require(path.join(root, 'node_modules/mongoose')).mongo;
  const port = await new Promise(resolve => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-it-mongo-'));
  const setName = `qa_${port}`;
  const args = ['--dbpath', dir, '--port', String(port), '--bind_ip', '127.0.0.1', '--logpath', path.join(dir, 'mongod.log')];
  if (replicaSet) args.push('--replSet', setName);
  const child = spawn(process.env.QA_MONGOD || 'mongod', args, { stdio: 'ignore' });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  async function stop() {
    if (child.exitCode === null && !spawnError) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const base = `mongodb://127.0.0.1:${port}`;
  const client = new MongoClient(`${base}/?directConnection=true`, { serverSelectionTimeoutMS: 500 });
  try {
    const deadline = Date.now() + 20000;
    while (true) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Test mongod exited: ${fs.readFileSync(path.join(dir, 'mongod.log'), 'utf8').slice(-1500)}`);
      try { await client.connect(); break; } catch (error) {
        if (Date.now() > deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    if (replicaSet) {
      await client.db('admin').command({ replSetInitiate: { _id: setName, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      while (!(await client.db('admin').command({ hello: 1 })).isWritablePrimary) {
        if (Date.now() > deadline) throw new Error('Test replica set did not elect a primary.');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    await client.close();
    return { uri: database => `${base}/${database}${replicaSet ? `?replicaSet=${setName}` : ''}`, stop };
  } catch (error) {
    await client.close();
    await stop();
    throw error;
  }
};
