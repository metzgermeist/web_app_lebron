import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { HttpError } from './catalog.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');

export function clientIp(request, trustedProxies) {
  const remote = request.socket.remoteAddress || 'unknown';
  // Only trust a single header overwritten by an explicitly allowed immediate proxy.
  // Do not trust X-Forwarded-For supplied by arbitrary clients.
  const real = request.headers['x-real-ip'];
  return trustedProxies.includes(remote) && typeof real === 'string' && isIP(real) ? real : remote;
}

export function createLimiter(db, now) {
  db.exec('CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
  return (key, limit, duration = 15 * 60_000) => {
    const time = now();
    db.prepare('DELETE FROM rate_limits WHERE expires<=?').run(time);
    const entry = db.prepare(`INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count,expires`).get(hash(key), time + duration);
    if (entry.count > limit) throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.');
  };
}

export function securityHeaders(response, { production = false } = {}) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (production) {
    response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests");
  }
}
