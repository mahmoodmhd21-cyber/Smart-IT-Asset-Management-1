const path = require("path");
// Resolve configuration beside the server, not a caller's working directory.
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const fs = require("fs");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const mongoose = require("mongoose");

// Import express
const express = require("express");
const cors = require("cors");

// Import database connection
const connectDB = require("./config/db.js");
const authRoutes = require("./routes/authRoutes");
const allocationRoutes = require("./routes/allocationRoutes");
const assetRoutes = require("./routes/assetRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const licenseRoutes = require("./routes/licenseRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const qrCodeRoutes = require("./routes/qrCodeRoutes");

// Create express application
const app = express();
const production = process.env.NODE_ENV === "production";
const build = path.join(__dirname, "frontend", "dist");
if (production && !fs.existsSync(path.join(build, "index.html"))) {
    throw new Error("Frontend build missing. Run npm ci and npm run build in frontend before production startup.");
}

// Middleware
app.disable("x-powered-by");
// Only trust the explicitly configured reverse proxy count, never arbitrary forwarding headers.
if (process.env.TRUST_PROXY_HOPS) {
    if (!/^\d+$/.test(process.env.TRUST_PROXY_HOPS)) throw new Error("TRUST_PROXY_HOPS must be a nonnegative integer.");
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
}
app.use(helmet({ contentSecurityPolicy: { directives: {
    "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"], "worker-src": ["'self'", "blob:"],
    "upgrade-insecure-requests": production ? [] : null,
} } }));
app.use((req, res, next) => { res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()"); next(); });
const origins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || origins.includes(origin)) }));
app.use(express.json({ limit: "64kb" }));
app.use("/api", (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Too many login attempts. Try again later." } }));
app.get("/health", (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ ready });
});

app.use("/api/auth", authRoutes);
app.use("/api/allocations", allocationRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/licenses", licenseRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/qr", qrCodeRoutes);

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found." }));
// Serve the current React build, never the obsolete public HTML implementation.
app.use(express.static(build, { redirect: false, index: false }));
app.get("*", (req, res) => {
    if (path.extname(req.path)) return res.sendStatus(404);
    if (fs.existsSync(path.join(build, "index.html"))) return res.sendFile(path.join(build, "index.html"));
    return res.status(200).send("Smart IT Asset Management API Running");
});
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.type === "entity.too.large" ? 413 : err instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ message: status === 413 ? "Request too large." : status === 400 ? "Invalid JSON body." : "Unexpected server error." });
});

// Server Port
const PORT = process.env.PORT || 5000;

// Start Server
if (require.main === module) {
    connectDB().then(() => {
        const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
        const stop = () => {
            const timeout = setTimeout(() => process.exit(1), 10000);
            timeout.unref();
            server.close(() => { void mongoose.disconnect().then(() => process.exit(0)); });
        };
        process.once("SIGTERM", stop);
        process.once("SIGINT", stop);
    }).catch(err => { console.error(err.message); process.exitCode = 1; });
}

module.exports = app;
