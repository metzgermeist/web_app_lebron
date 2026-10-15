import http from 'node:http';
import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, validateProduct } from './catalog.mjs';
import { createAuth } from './auth.mjs';
import { clientIp, createLimiter, securityHeaders } from './security.mjs';
import { createMailer, createImageStore, sanitizeImage } from './services.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
};
async function body(request, maxBytes = 7 * 1024 * 1024) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Se espera JSON.');
  const chunks = []; let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) throw new HttpError(413, 'El archivo o solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString());
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid object');
    return result;
  }
  catch { throw new HttpError(400, 'JSON inválido.'); }
}

export function createApp({ dataDir = process.env.DATA_DIR || path.join(project, '.data'),
  secureCookies = process.env.NODE_ENV === 'production',
  publicOrigin = process.env.PUBLIC_ORIGIN, seed = true,
  mailer = createMailer(), imageStore = createImageStore(),
  ownerEmail = process.env.ADMIN_EMAIL,
  trustedProxies = (process.env.TRUSTED_PROXY_IPS || '').split(',').map(value => value.trim()).filter(Boolean),
  now = Date.now } = {}) {
  if (secureCookies && (!publicOrigin || new URL(publicOrigin).protocol !== 'https:' || new URL(publicOrigin).origin !== publicOrigin)) {
    throw new Error('En producción PUBLIC_ORIGIN debe ser un origen HTTPS sin barra final.');
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const uploads = path.join(dataDir, 'uploads'); fs.mkdirSync(uploads, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'catalog.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, visible INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const save = db.prepare('INSERT INTO products(id, data, visible) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, visible=excluded.visible');
  const saveProduct = product => save.run(product.id, JSON.stringify(product), product.visible ? 1 : 0);
  const allProducts = (publicOnly = false) => db.prepare(`SELECT data FROM products ${publicOnly ? 'WHERE visible=1' : ''} ORDER BY rowid DESC`).all().map(row => JSON.parse(row.data));
  if (seed && !db.prepare('SELECT value FROM meta WHERE key=?').get('seeded')) {
    const products = JSON.parse(fs.readFileSync(path.join(project, 'src/data/productos.json'), 'utf8'));
    db.exec('BEGIN');
    try {
      products.forEach(product => saveProduct(validateProduct({ ...product, visible: true, disponible: true })));
      db.prepare('INSERT INTO meta VALUES(?, ?)').run('seeded', '1'); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const limit = createLimiter(db, now);
  const ip = request => clientIp(request, trustedProxies);
  const auth = createAuth({ db, mailer, json, body, limit, ip, secureCookies, ownerEmail, now });
  const server = http.createServer(async (request, response) => {
    securityHeaders(response, { production: secureCookies });
    try {
      const url = new URL(request.url, 'http://localhost');
      const route = url.pathname;
      if (route === '/admin' || route.startsWith('/admin/')) response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      if (route === '/robots.txt') {
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return response.end('User-agent: *\nDisallow: /admin\nDisallow: /api/admin/\n');
      }
      if (route.startsWith('/api/')) {
        limit(`api:${ip(request)}`, 600, 60_000);
        if (!['GET', 'HEAD'].includes(request.method)) {
          const origin = request.headers.origin;
          const expected = publicOrigin || `http://${request.headers.host}`;
          if ((origin && origin !== expected) || request.headers['sec-fetch-site'] === 'cross-site'
            || (secureCookies && !origin)) throw new HttpError(403, 'Origen no permitido.');
        }
        if (route === '/api/catalogo/productos' && request.method === 'GET') return json(response, 200, allProducts(true));
        if (await auth.handle(request, response, route)) return;
        const user = auth.session(request);
        if (!user) throw new HttpError(401, 'Iniciá sesión para administrar el catálogo.');
        if (route === '/api/admin/products' && request.method === 'GET') return json(response, 200, allProducts());
        if (route === '/api/admin/products' && request.method === 'POST') {
          const product = validateProduct(await body(request), randomUUID());
          saveProduct(product); return json(response, 201, product);
        }
        const match = route.match(/^\/api\/admin\/products\/([\w-]+)$/);
        if (match && request.method === 'PUT') {
          if (!db.prepare('SELECT id FROM products WHERE id=?').get(match[1])) throw new HttpError(404, 'Producto no encontrado.');
          const product = validateProduct(await body(request), match[1]);
          saveProduct(product); return json(response, 200, product);
        }
        if (route === '/api/admin/import' && request.method === 'POST') {
          const input = await body(request);
          if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > 500) throw new HttpError(400, 'Importá entre 1 y 500 productos.');
          const products = input.products.map(product => validateProduct(product));
          if (new Set(products.map(product => product.id)).size !== products.length) throw new HttpError(400, 'El archivo tiene identificadores duplicados.');
          if (input.preview === true) return json(response, 200, { products });
          db.exec('BEGIN');
          try { products.forEach(saveProduct); db.exec('COMMIT'); }
          catch (error) { db.exec('ROLLBACK'); throw error; }
          return json(response, 200, { count: products.length });
        }
        if (route === '/api/admin/uploads' && request.method === 'POST') {
          limit(`upload:${user.id}`, 20);
          const bytes = await sanitizeImage((await body(request)).data);
          if (imageStore.mode === 'r2') return json(response, 201, await imageStore.upload(bytes));
          const name = `${randomUUID()}.webp`;
          fs.writeFileSync(path.join(uploads, name), bytes, { flag: 'wx', mode: 0o600 });
          return json(response, 201, { url: `/uploads/${name}` });
        }
        throw new HttpError(404, 'Ruta no encontrada.');
      }
      if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'Método no permitido.');
      if (route.startsWith('/media/')) {
        if (imageStore.mode !== 'r2') throw new HttpError(404, 'Imagen no encontrada.');
        limit(`media:${ip(request)}`, 600, 60_000);
        const { bytes } = await imageStore.read(route.slice(7));
        response.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': bytes.length, 'Cache-Control': 'public, max-age=86400, immutable' });
        return response.end(request.method === 'HEAD' ? undefined : bytes);
      }
      let base = path.join(project, 'dist'), relative = decodeURIComponent(route).replace(/^\/+/, '');
      if (route.startsWith('/uploads/')) { base = uploads; relative = route.slice(9); }
      else if (route.startsWith('/img/')) { base = path.join(project, 'img'); relative = route.slice(5); }
      const filename = path.resolve(base, relative || 'index.html');
      if (relative.split(/[\\/]/).some(part => part.startsWith('.')) || relative.includes('\\')) throw new HttpError(403, 'Ruta no permitida.');
      if (!filename.startsWith(path.resolve(base) + path.sep)) throw new HttpError(403, 'Ruta no permitida.');
      let target = filename;
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        if (base !== path.join(project, 'dist') || path.extname(relative)) throw new HttpError(404, 'Archivo no encontrado.');
        target = path.join(base, 'index.html');
      }
      if (!fs.existsSync(target)) throw new HttpError(503, 'Ejecutá npm run build para preparar el sitio.');
      const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml' };
      response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      if (request.method === 'HEAD') response.end(); else fs.createReadStream(target).pipe(response);
    } catch (error) {
      if (error.status === 429) response.setHeader('Retry-After', '900');
      if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación.' });
      else response.destroy();
      if (!error.status) console.error('Error interno al procesar una solicitud.');
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.maxHeadersCount = 50;
  const makeBackup = async () => {
    const folder = path.join(dataDir, 'backups'); fs.mkdirSync(folder, { recursive: true });
    const snapshot = path.join(folder, new Date().toISOString().replaceAll(':','-'));
    fs.mkdirSync(snapshot, { recursive:true });
    const name = path.join(snapshot, 'catalog.sqlite');
    await backup(db, name);
    await fs.promises.cp(uploads, path.join(snapshot,'uploads'), { recursive:true });
    return name;
  };
  server.on('close', () => { db.close(); imageStore.close?.(); });
  return { server, get setupToken() { return auth.setupToken; }, makeBackup };
}
