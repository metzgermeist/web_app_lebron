import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import sharp from 'sharp';
import { testApp } from './test-support.mjs';
import { clientIp } from './security.mjs';
import { createApp } from './app.mjs';
import { createAuth } from './auth.mjs';

const credentials = { username: 'admin', email: 'owner@example.com', password: 'testing-password-123' };
const startSetup = fixture => fixture.call('setup', { ...credentials, token: fixture.app.setupToken });

test('No se crea ni habilita una cuenta antes de verificar el correo; el código es de un solo uso', async t => {
  const f = await testApp(t);
  const pending = await startSetup(f);
  assert.equal(pending.response.status, 202);
  assert.equal(pending.response.headers.get('set-cookie'), null);
  assert.equal((await f.call('session')).data.needsSetup, true);
  assert.equal((await f.call('products')).response.status, 401);
  assert.equal((await f.verify(pending)).response.status, 200);
  assert.equal((await f.call('session')).data.email, credentials.email);
  assert.equal((await f.call('verify', { challengeId: pending.data.challengeId, code: f.mailer.code() })).response.status, 400);
  assert.equal((await startSetup(f)).response.status, 403);
  const db = new DatabaseSync(f.dataDir + '/catalog.sqlite');
  const user = db.prepare('SELECT * FROM users').get();
  assert.equal(user.email_verified, 1);
  assert.notEqual(user.password, credentials.password);
  assert.notEqual(db.prepare('SELECT token FROM sessions').get().token, f.cookie.split('=')[1]);
  db.close();
});

test('Código incorrecto bloqueado al quinto intento, aun con el código correcto después', async t => {
  const f = await testApp(t);
  const pending = await startSetup(f);
  const code = f.mailer.code();
  const wrong = code === '00000000' ? '11111111' : '00000000';
  for (let i = 0; i < 5; i++) assert.equal((await f.call('verify', { challengeId: pending.data.challengeId, code: wrong })).response.status, 400);
  assert.equal((await f.call('verify', { challengeId: pending.data.challengeId, code })).response.status, 400);
  assert.equal((await f.call('products')).response.status, 401);
});

test('Códigos vencen y el límite de intentos sobrevive al reinicio', async t => {
  let clock = Date.now();
  const f = await testApp(t, { now: () => clock });
  const pending = await startSetup(f);
  clock += 10 * 60_000 + 1;
  assert.equal((await f.verify(pending)).response.status, 400);
  for (let i = 0; i < 10; i++) await f.call('login', { username: 'no-user', password: 'incorrect' });
  assert.equal((await f.call('login', credentials)).response.status, 429);
  // A second connection reads the same persistent limiter; closing this instance leaves the original running.
  const second = createApp({ dataDir: f.dataDir, secureCookies: false, seed: false, mailer: f.mailer, ownerEmail: null, now: () => clock });
  await new Promise(resolve => second.server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${second.server.address().port}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
    });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '900');
  } finally { await new Promise(resolve => second.server.close(resolve)); }
});

test('Verificar un nuevo acceso invalida la sesión anterior; expira por inactividad', async t => {
  let clock = Date.now();
  const f = await testApp(t, { now: () => clock });
  await f.setup();
  const oldCookie = f.cookie;
  const pending = await f.call('login', credentials);
  assert.equal(pending.response.status, 202);
  const verified = await f.verify(pending);
  assert.equal(verified.response.status, 200);
  assert.notEqual(oldCookie, f.cookie);
  assert.equal((await f.call('products', undefined, { headers: { Cookie: oldCookie } })).response.status, 401);
  assert.equal((await f.call('products')).response.status, 200);
  clock += 31 * 60_000;
  assert.equal((await f.call('products')).response.status, 401);
});

test('Recuperación no revela si existe el correo, cambia la contraseña y revoca sesiones y códigos', async t => {
  const f = await testApp(t);
  await f.setup();
  const unknown = await f.call('forgot-password', { email: 'unknown@example.com' });
  const reset = await f.call('forgot-password', { email: credentials.email });
  assert.equal(reset.response.status, unknown.response.status);
  assert.equal(reset.data.message, unknown.data.message);
  const code = f.mailer.code();
  const input = { challengeId: reset.data.challengeId, code, password: 'a-new-secure-password-123' };
  assert.equal((await f.call('reset-password', { ...input, challengeId: unknown.data.challengeId })).response.status, 400);
  assert.equal((await f.call('reset-password', input)).response.status, 200);
  assert.equal((await f.call('products')).response.status, 401);
  assert.equal((await f.call('reset-password', input)).response.status, 400);
  assert.equal((await f.call('login', credentials)).response.status, 401);
  assert.equal((await f.verify(await f.call('login', { ...credentials, password: input.password }))).response.status, 200);
  assert.ok(f.mailer.messages.some(message => message.subject.includes('contraseña modificada')));
});

test('Cambio de contraseña requiere sesión y contraseña actual y cierra las sesiones', async t => {
  const f = await testApp(t);
  const input = { currentPassword: credentials.password, password: 'another-secure-password-456' };
  assert.equal((await f.call('change-password', input)).response.status, 401);
  await f.setup();
  assert.equal((await f.call('change-password', { ...input, currentPassword: 'incorrect' })).response.status, 400);
  assert.equal((await f.call('change-password', input)).response.status, 200);
  assert.equal((await f.call('products')).response.status, 401);
});

test('Sin correo configurado o con un proveedor caído no se activa una cuenta ni se entrega sesión', async t => {
  const f = await testApp(t, { mailer: { ready: false } });
  assert.equal((await startSetup(f)).response.status, 503);
  assert.equal((await f.call('session')).data.needsSetup, true);
  const failing = await testApp(t, { mailer: { ready: true, async send() { throw new Error('SMTP down'); } } });
  assert.equal((await startSetup(failing)).response.status, 500);
  const db = new DatabaseSync(failing.dataDir + '/catalog.sqlite');
  assert.equal(db.prepare('SELECT count(*) AS count FROM auth_challenges').get().count, 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 0);
  db.close();
});

test('La migración conserva al administrador existente y exige vincular su correo', async t => {
  const f = await testApp(t);
  const db = new DatabaseSync(f.dataDir + '/catalog.sqlite');
  const salt = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users(username,salt,password) VALUES(?,?,?)').run(credentials.username, salt, scryptSync(credentials.password, salt, 64).toString('hex'));
  const pending = await f.call('login', credentials);
  assert.equal(pending.data.enrollmentRequired, true);
  assert.equal((await f.call('products')).response.status, 401);
  assert.equal((await f.call('enroll-email', { challengeId: '0'.repeat(64), email: credentials.email })).response.status, 400);
  const emailPending = await f.call('enroll-email', { challengeId: pending.data.challengeId, email: credentials.email });
  assert.equal(emailPending.response.status, 202);
  assert.equal((await f.verify(emailPending)).response.status, 200);
  assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 1);
  assert.equal(db.prepare('SELECT email_verified FROM users').get().email_verified, 1);
  db.close();
});

test('Migración desde el esquema original revoca sesiones previas y conserva los datos del usuario', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO users VALUES(1,'original','old-salt','old-password-hash');
    INSERT INTO sessions VALUES('old-session',1,9999999999999);`);
  createAuth({ db, mailer: { ready: false }, secureCookies: false, now: Date.now, ownerEmail: null });
  const user = db.prepare('SELECT * FROM users').get();
  assert.equal(user.username, 'original');
  assert.equal(user.password, 'old-password-hash');
  assert.equal(user.email_verified, 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM sessions').get().count, 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, 1);
  db.close();
});

test('El correo fijado por el dueño no puede sustituirse durante el alta', async t => {
  const f = await testApp(t, { ownerEmail: 'real-owner@example.com' });
  assert.equal((await startSetup(f)).response.status, 403);
  assert.equal(f.mailer.messages.length, 0);
});

test('Headers de producción, CSRF, cookies seguras y JSON inválido', async t => {
  const f = await testApp(t, { secureCookies: true, publicOrigin: 'https://lebron.example' });
  const ready = await f.setup();
  assert.equal(ready.response.status, 200);
  assert.match(ready.response.headers.get('set-cookie'), /^__Host-lebron_session=.*; HttpOnly; SameSite=Strict; Path=\/; Max-Age=7200; Secure$/);
  assert.match(ready.response.headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(ready.response.headers.get('strict-transport-security'), /31536000/);
  const cross = await f.call('logout', {}, { headers: { Origin: 'https://attacker.example' } });
  assert.equal(cross.response.status, 403);
  const missingOrigin = await fetch(f.origin + '/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(missingOrigin.status, 403);
  const invalid = await fetch(f.origin + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://lebron.example' }, body: 'null' });
  assert.equal(invalid.status, 400);
  assert.equal((await fetch(f.origin + '/.env')).status, 403);
  assert.equal((await fetch(f.origin + '/admin')).headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal((await f.call('session', {})).response.status, 405);
  const oversized = await f.call('login', { username: 'a'.repeat(17 * 1024), password: 'test' });
  assert.equal(oversized.response.status, 413);
});

test('IP falsificada ignorada salvo proxy inmediato permitido explícitamente', () => {
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '198.51.100.2' } };
  assert.equal(clientIp(req, []), '127.0.0.1');
  assert.equal(clientIp(req, ['127.0.0.1']), '198.51.100.1');
  req.headers['x-real-ip'] = '198.51.100.1, 198.51.100.2';
  assert.equal(clientIp(req, ['127.0.0.1']), '127.0.0.1');
});

test('Subidas autenticadas se decodifican, convierten a WebP y rechazan archivos falsificados', async t => {
  let received;
  const f = await testApp(t, { imageStore: { mode: 'r2', async upload(bytes) { received = bytes; return { url: '/media/33333333-3333-4333-8333-333333333333.webp' }; } } });
  assert.equal((await f.call('uploads', { data: '' })).response.status, 401);
  await f.setup();
  const fake = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
  assert.equal((await f.call('uploads', { data: `data:image/png;base64,${fake}` })).response.status, 400);
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const result = await f.call('uploads', { data: `data:image/png;base64,${png.toString('base64')}` });
  assert.equal(result.response.status, 201);
  assert.equal((await sharp(received).metadata()).format, 'webp');
  assert.equal((await f.call('uploads', { data: `data:image/jpeg;base64,${png.toString('base64')}` })).response.status, 400);
});
