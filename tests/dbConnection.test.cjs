const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

test('connection failures report the nested TLS cause without leaking credentials', async t => {
    const originalConnect = mongoose.connect;
    const originalUri = process.env.MONGO_URI;
    t.after(() => {
        mongoose.connect = originalConnect;
        if (originalUri === undefined) delete process.env.MONGO_URI;
        else process.env.MONGO_URI = originalUri;
    });
    const password = 'sample%40password';
    const uri = `mongodb+srv://example:${password}@cluster.example.test/database`;
    process.env.MONGO_URI = uri;
    const cause = Object.assign(new Error('TLS alert'), { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' });
    const failure = Object.assign(new Error(`Could not connect: ${uri} ${password} sample@password`), {
        reason: { servers: new Map([['node.example.test', { error: { cause } }]]) },
    });
    mongoose.connect = async () => { throw failure; };
    await assert.rejects(connectDB(), error => {
        assert.equal(error.cause, failure);
        assert.match(error.message, /ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR/);
        assert.match(error.message, /before database authentication/);
        assert.ok(!error.message.includes(uri));
        assert.ok(!error.message.includes(password));
        assert.ok(!error.message.includes('sample@password'));
        return true;
    });
});

test('missing URI fails before attempting a database connection', async t => {
    const originalUri = process.env.MONGO_URI;
    delete process.env.MONGO_URI;
    t.after(() => {
        if (originalUri !== undefined) process.env.MONGO_URI = originalUri;
    });
    await assert.rejects(connectDB(), /MONGO_URI is required/);
});
