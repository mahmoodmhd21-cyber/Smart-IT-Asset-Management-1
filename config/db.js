// config/db.js
const mongoose = require("mongoose");

// Report nested driver failures without logging the connection string or password.
const connectionErrorMessage = (error, uri) => {
    const servers = Array.from(error.reason?.servers?.values() || []);
    const codes = [...new Set(servers.map(server => server.error?.cause?.code || server.error?.code)
        .filter(code => typeof code === "string" && /^(ERR_SSL_[A-Z0-9_]+|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)$/.test(code)))];
    let message = String(error.message).split(uri).join("[redacted MongoDB URI]")
        .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted MongoDB URI]");
    try {
        const password = new URL(uri).password;
        for (const value of [password, decodeURIComponent(password)]) {
            if (value) message = message.split(value).join("[redacted password]");
        }
    } catch { /* The driver reports malformed URIs; never print the URI here. */ }
    if (codes.length) message += ` Underlying connection error: ${codes.join(", ")}.`;
    if (codes.some(code => code.startsWith("ERR_SSL_"))) {
        message += " TLS handshake failed before database authentication. Check Atlas access for this backend's public IP (Safari Private Relay or a proxy may show a different IP), and check the network's TLS filtering.";
    }
    return `MongoDB connection failed: ${message}`;
};

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        throw new Error("MONGO_URI is required.");
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            family: 4, // Use IPv4, skip trying IPv6
        });

        console.log("MongoDB connected successfully");
        return mongoose.connection;
    } catch (error) {
        throw new Error(connectionErrorMessage(error, uri), { cause: error });
    }
};

module.exports = connectDB;
