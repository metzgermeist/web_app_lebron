import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './catalog.mjs';
import { hash } from './security.mjs';

const derive = promisify(scrypt);
const lifetime = 10 * 60_000;
const invalidCode = () => new HttpError(400, 'Código inválido, vencido o ya utilizado. Volvé a iniciar el proceso.');
const routes = new Set(['session', 'setup', 'login', 'enroll-email', 'verify', 'forgot-password', 'reset-password', 'change-password', 'logout']);
const emailValue = value => {
  if (typeof value !== 'string') throw new HttpError(400, 'Ingresá un correo válido.');
  const email = value.trim();
  if (email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(email)) throw new HttpError(400, 'Ingresá un correo válido.');
  const at = email.lastIndexOf('@');
  return email.slice(0, at) + '@' + email.slice(at + 1).toLowerCase();
};
const validPassword = password => {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200 || !password.trim()) {
    throw new HttpError(400, 'Elegí una contraseña de entre 12 y 200 caracteres. Podés usar una frase larga.');
  }
};
const passwordRecord = async password => {
  const salt = randomBytes(16).toString('hex');
  return { salt, password: (await derive(password, salt, 64)).toString('hex') };
};
const matchesPassword = async (value, user) => {
  if (typeof value !== 'string' || value.length > 200) return false;
  const candidate = await derive(value, user?.salt || 'invalid-user-salt', 64);
  return Boolean(user && timingSafeEqual(candidate, Buffer.from(user.password, 'hex')));
};

export function createAuth({ db, mailer, json, body, limit, ip, secureCookies, ownerEmail, now = Date.now }) {
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
  const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all().map(column => column.name);
  db.exec('BEGIN');
  try {
    if (!userColumns.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    if (!userColumns.includes('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
    if (!sessionColumns.includes('last_seen')) db.exec('ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0');
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email) WHERE email IS NOT NULL;
      CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id INTEGER,
        code_hash TEXT, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL);`);
    if (!db.prepare('SELECT value FROM meta WHERE key=?').get('email-auth-v1')) {
      db.exec('DELETE FROM sessions');
      db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('email-auth-v1', '1');
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const pinnedEmail = ownerEmail ? emailValue(ownerEmail) : null;
  const needsSetup = () => !db.prepare('SELECT id FROM users LIMIT 1').get();
  let setupToken = needsSetup() ? randomBytes(24).toString('hex') : null;
  const cookieName = secureCookies ? '__Host-lebron_session' : 'lebron_session';
  function cookie(response, token, age = 7200) {
    response.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookies ? '; Secure' : ''}`);
  }
  function sessionToken(request) {
    return request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  }
  function session(request) {
    const token = sessionToken(request);
    if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
    const user = db.prepare(`SELECT users.id,users.username,users.email FROM sessions JOIN users ON users.id=sessions.user_id
      WHERE token=? AND expires>? AND last_seen>? AND users.email_verified=1`).get(hash(token), now(), now() - 30 * 60_000);
    if (user) db.prepare('UPDATE sessions SET last_seen=? WHERE token=?').run(now(), hash(token));
    return user;
  }
  function login(response, user) {
    // Only one active administrative session. Verification invalidates old codes too.
    db.prepare('DELETE FROM sessions WHERE user_id=? OR expires<=?').run(user.id, now());
    db.prepare('DELETE FROM auth_challenges WHERE user_id=?').run(user.id);
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions(token,user_id,expires,last_seen) VALUES(?,?,?,?)').run(hash(token), user.id, now() + 2 * 3600_000, now());
    cookie(response, token);
    json(response, 200, { username: user.username, email: user.email });
  }
  function requireMailer() {
    if (!mailer.ready) throw new HttpError(503, 'Falta configurar el servicio de correo. El acceso administrativo permanece protegido.');
  }
  function cleanup() { db.prepare('DELETE FROM auth_challenges WHERE expires<=?').run(now()); }
  async function challenge(kind, payload, userId, email, id = randomBytes(32).toString('hex')) {
    requireMailer(); cleanup();
    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    db.prepare('INSERT INTO auth_challenges(id,kind,user_id,code_hash,payload,expires) VALUES(?,?,?,?,?,?)')
      .run(hash(id), kind, userId || null, hash(`${id}:${code}`), JSON.stringify(payload), now() + lifetime);
    try {
      await mailer.send({ to: email, subject: kind === 'reset' ? 'LeBron: recuperar contraseña' : 'LeBron: código de verificación',
        text: `Tu código para ${kind === 'setup' || kind === 'enroll' ? 'verificar tu correo' : kind === 'reset' ? 'recuperar la contraseña' : 'ingresar al panel'} es: ${code}\n\nVence en 10 minutos y se puede usar una sola vez. No compartas este código. Si no lo solicitaste, ignorá este correo.`,
      });
    } catch (error) { if (db.isOpen) db.prepare('DELETE FROM auth_challenges WHERE id=?').run(hash(id)); throw error; }
    return { challengeId: id, expiresIn: 600, verificationRequired: true };
  }
  function readChallenge(id, kinds, code) {
    const entry = typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)
      ? db.prepare('SELECT * FROM auth_challenges WHERE id=?').get(hash(id)) : null;
    if (!entry || !kinds.includes(entry.kind) || entry.expires <= now() || entry.attempts >= 5) throw invalidCode();
    if (code !== undefined) {
      db.prepare('UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?').run(entry.id);
      if (typeof code !== 'string' || !/^\d{8}$/.test(code) || !timingSafeEqual(Buffer.from(hash(`${id}:${code}`)), Buffer.from(entry.code_hash))) throw invalidCode();
    }
    return { ...entry, payload: JSON.parse(entry.payload) };
  }
  function enrollTicket(user) {
    cleanup();
    const id = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO auth_challenges(id,kind,user_id,payload,expires) VALUES(?,?,?,?,?)')
      .run(hash(id), 'enroll-ticket', user.id, JSON.stringify({ password: user.password }), now() + lifetime);
    return { enrollmentRequired: true, challengeId: id };
  }
  async function notifyPassword(email) {
    try { await mailer.send({ to: email, subject: 'LeBron: contraseña modificada', text: 'Se modificó la contraseña de administración de LeBron y se cerraron las sesiones activas. Si no fuiste vos, recuperá la contraseña desde /admin y revisá la seguridad de tu correo.' }); }
    catch { console.error('No se pudo enviar el aviso de cambio de contraseña.'); }
  }
  return {
    session,
    get setupToken() { return setupToken; },
    async handle(request, response, route) {
      const action = route.replace('/api/admin/', '');
      if (!route.startsWith('/api/admin/') || !routes.has(action)) return false;
      response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      if (action === 'session' && request.method !== 'GET') throw new HttpError(405, 'Método no permitido.');
      if (action === 'session' && request.method === 'GET') {
        const user = session(request);
        json(response, 200, { username: user?.username || null, email: user?.email || null, needsSetup: needsSetup(), mailReady: mailer.ready });
        return true;
      }
      if (request.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      limit(`auth:${ip(request)}`, 50);
      const input = await body(request, 16 * 1024);
      if (action === 'setup') {
        limit(`setup:${ip(request)}`, 10);
        if (!needsSetup() || !setupToken || typeof input.token !== 'string' || hash(input.token) !== hash(setupToken)) throw new HttpError(403, 'Código de instalación inválido o ya utilizado.');
        requireMailer();
        const email = emailValue(input.email);
        if (pinnedEmail && email !== pinnedEmail) throw new HttpError(403, 'Usá el correo del administrador configurado en el servidor.');
        if (typeof input.username !== 'string' || !/^[\w.@-]{3,80}$/.test(input.username)) throw new HttpError(400, 'Usá un usuario de entre 3 y 80 caracteres.');
        validPassword(input.password);
        limit(`mail:${hash(email)}`, 3);
        const record = await passwordRecord(input.password);
        if (!needsSetup()) throw new HttpError(409, 'El administrador ya fue creado.');
        const result = await challenge('setup', { username: input.username, email, ...record, setupHash: hash(setupToken || '') }, null, email);
        json(response, 202, result);
      } else if (action === 'login') {
        limit(`login:${ip(request)}`, 10);
        const username = typeof input.username === 'string' ? input.username.slice(0, 80) : '';
        limit(`login-user:${hash(username)}`, 20);
        const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
        if (!await matchesPassword(input.password, user)) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
        requireMailer();
        if (!user.email_verified || !user.email) json(response, 202, enrollTicket(user));
        else {
          limit(`mail:${hash(user.email)}`, 3);
          json(response, 202, await challenge('login', { password: user.password }, user.id, user.email));
        }
      } else if (action === 'enroll-email') {
        const entry = readChallenge(input.challengeId, ['enroll-ticket']);
        const user = db.prepare('SELECT * FROM users WHERE id=?').get(entry.user_id);
        if (!user || user.email_verified || user.password !== entry.payload.password) throw invalidCode();
        const email = emailValue(input.email);
        if (pinnedEmail && email !== pinnedEmail) throw new HttpError(403, 'Usá el correo del administrador configurado en el servidor.');
        limit(`mail:${hash(email)}`, 3);
        db.prepare('DELETE FROM auth_challenges WHERE id=?').run(entry.id);
        json(response, 202, await challenge('enroll', { email, password: user.password }, user.id, email));
      } else if (action === 'verify') {
        const entry = readChallenge(input.challengeId, ['setup', 'enroll', 'login'], input.code);
        const data = entry.payload;
        // All checks and consumption below are synchronous; concurrent submissions cannot reuse a code.
        if (entry.kind === 'setup') {
          if (!needsSetup() || !setupToken || data.setupHash !== hash(setupToken)) throw invalidCode();
          db.prepare('INSERT INTO users(username,salt,password,email,email_verified) VALUES(?,?,?,?,1)').run(data.username, data.salt, data.password, data.email);
          setupToken = null;
          db.prepare("DELETE FROM auth_challenges WHERE kind='setup'").run();
          login(response, db.prepare('SELECT * FROM users WHERE username=?').get(data.username));
        } else {
          const user = db.prepare('SELECT * FROM users WHERE id=?').get(entry.user_id);
          if (!user || user.password !== data.password) throw invalidCode();
          if (entry.kind === 'enroll') {
            if (user.email_verified) throw invalidCode();
            db.prepare('UPDATE users SET email=?,email_verified=1 WHERE id=?').run(data.email, user.id);
            user.email = data.email;
          } else if (!user.email_verified) throw invalidCode();
          login(response, user);
        }
      } else if (action === 'forgot-password') {
        requireMailer(); limit(`recovery:${ip(request)}`, 5);
        const email = emailValue(input.email);
        limit(`mail:${hash(email)}`, 3);
        const user = db.prepare('SELECT * FROM users WHERE email=? AND email_verified=1').get(email);
        const challengeId = randomBytes(32).toString('hex');
        if (user) {
          // Do not wait for the provider: account existence must not change HTTP timing.
          // A failure removes the challenge; no token or recipient is logged.
          setImmediate(() => {
            if (db.isOpen) challenge('reset', { password: user.password }, user.id, user.email, challengeId)
              .catch(() => console.error('No se pudo entregar un correo de recuperación.'));
          });
        }
        json(response, 202, { challengeId, message: 'Si ese correo corresponde al administrador, recibirás un código para recuperar la contraseña.' });
      } else if (action === 'reset-password') {
        validPassword(input.password);
        const entry = readChallenge(input.challengeId, ['reset'], input.code);
        const user = db.prepare('SELECT * FROM users WHERE id=?').get(entry.user_id);
        if (!user || !user.email_verified || user.password !== entry.payload.password) throw invalidCode();
        db.prepare('DELETE FROM auth_challenges WHERE id=?').run(entry.id);
        const record = await passwordRecord(input.password);
        const update = db.prepare('UPDATE users SET salt=?,password=? WHERE id=? AND password=?').run(record.salt, record.password, user.id, user.password);
        if (!update.changes) throw invalidCode();
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        db.prepare('DELETE FROM auth_challenges WHERE user_id=?').run(user.id);
        cookie(response, '', 0);
        await notifyPassword(user.email);
        json(response, 200, { ok: true });
      } else if (action === 'change-password') {
        const active = session(request);
        if (!active) throw new HttpError(401, 'Iniciá sesión para cambiar la contraseña.');
        limit(`password-change:${active.id}`, 5);
        validPassword(input.password);
        const user = db.prepare('SELECT * FROM users WHERE id=?').get(active.id);
        if (!await matchesPassword(input.currentPassword, user)) throw new HttpError(400, 'La contraseña actual no es correcta.');
        const record = await passwordRecord(input.password);
        const update = db.prepare('UPDATE users SET salt=?,password=? WHERE id=? AND password=?').run(record.salt, record.password, user.id, user.password);
        if (!update.changes) throw new HttpError(409, 'La cuenta cambió. Volvé a iniciar sesión.');
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
        db.prepare('DELETE FROM auth_challenges WHERE user_id=?').run(user.id);
        cookie(response, '', 0); await notifyPassword(user.email);
        json(response, 200, { ok: true });
      } else if (action === 'logout') {
        const token = sessionToken(request);
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
        cookie(response, '', 0); json(response, 200, { ok: true });
      }
      return true;
    },
  };
}
