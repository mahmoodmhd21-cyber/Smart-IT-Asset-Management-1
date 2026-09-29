# Deployment and Release Gates

## Supported Layout

Serve the built React frontend and `/api` from this Node application behind an HTTPS reverse proxy. Node serves SPA deep links, JSON 404s for unknown API routes, a database-readiness `/health` endpoint, bounded JSON bodies, security headers and a login rate limit. The obsolete `public/` frontend is not served.

Use Node 22 and a MongoDB replica set. One MongoDB node supports transactions but is not a high-availability deployment. Keep the Node port private to the reverse proxy. Set `TRUST_PROXY_HOPS` to the actual trusted proxy count; do not blindly trust forwarding headers. TLS termination, certificate renewal and firewall configuration belong to the deployment host. Same-origin hosting needs no CORS allowlist; set explicit `CORS_ORIGINS` only for a separate trusted frontend.

The login limiter is per Node process (20 requests per IP per 15 minutes). For multiple instances, use a shared rate-limit store or enforce equivalent limits at the proxy. Do not use the development Vite server as a production host. CSP permits inline styles for the existing React design, but not inline scripts. The camera requires HTTPS or localhost.

## Build and Start

```sh
npm ci
npm ci --prefix frontend
npm run lint --prefix frontend -- --max-warnings=0
npm run build --prefix frontend
NODE_ENV=production node server.js
```

Provide configuration through protected environment variables or a local `.env` based on `.env.example`. Generate a new random JWT secret privately. Startup refuses missing database configuration, failed database connection, invalid JWT configuration and a missing production frontend build. SIGTERM/SIGINT drains HTTP connections and closes MongoDB, with a bounded shutdown timeout.

An optional non-root container definition is included:

```sh
docker build -t smart-it-assets .
docker run --env-file /secure/path/asset.env -p 127.0.0.1:5000:5000 smart-it-assets
```

The container definition and GitHub workflow are supplied but must be validated on the chosen host/CI runner. They have not been executed in this local verification. The environment file is excluded from container builds.

## Secrets and Existing Data

`.env` has been removed from the Git index without deleting the local file. This does not remove secrets from earlier commits. Rotate exposed JWT/database credentials before release and arrange history remediation if the repository was shared. JWT rotation logs out existing users. Do not commit private backups or audit state files containing disposable credentials.

Back up the target replica set before deployment. Run the lifecycle/index preflight in `ASSET_LIFECYCLE.md` and review `ASSET_SERIAL_NUMBERS.md`. Three historical allocation-to-employee mappings still require an owner decision; do not guess the employee identities. No production data migration or secret rotation was performed by this release pass.

## Host Acceptance Checklist

- Verify HTTPS, proxy forwarding, allowed origins, security headers, SPA deep links, login throttling, camera permissions and authenticated PNG downloads on the actual domain.
- Test physical printed QR labels on supported hardware and browsers. Local automated coverage uses Chrome and synthetic camera frames, not physical devices or Safari/Firefox/Edge.
- Encrypt backups, restrict access, define retention and off-site storage, and restore one backup to an isolated replica set. Compare collection counts, representative records and transaction behavior. Never restore a test archive over the live database.
- Define monitoring for `/health`, failed logins, server errors, disk space and backup age; run failover, capacity and recovery drills with agreed RPO/RTO.
- Keep the prior versioned image/build and verified backup for rollback. Roll back code first when schemas remain compatible; obtain approval and validate restore procedures before changing data.
- Complete manual keyboard/screen-reader checks, real-device sign-off and the three historical ownership decisions. Passing automated tests is not production certification.

The current dependency audit is recorded separately in QA evidence. Compatible updates were applied without `--force`; see [npm audit guidance](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/). Proxy/TLS and operational controls follow [Express production guidance](https://expressjs.com/en/advanced/best-practice-performance/).
