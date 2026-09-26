// Never sign tokens with a known fallback secret, even in development.
const secret = process.env.JWT_SECRET;
if (!secret || secret.trim().length < 32 || secret === 'dev-jwt-secret') {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

module.exports = { secret, algorithms: ['HS256'] };
