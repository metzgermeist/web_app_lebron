import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageStore, createMailer } from './services.mjs';
import { testApp } from './test-support.mjs';

const r2env = { IMAGE_STORAGE: 'r2', R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET: 'lebron-catalogo', R2_ACCESS_KEY_ID: 'test-access-key', R2_SECRET_ACCESS_KEY: 'test-secret' };

test('R2 usa solo el bucket de Lebron, guarda WebP y entrega una dirección estable sin secretos', async () => {
  const calls = [];
  const bytes = Buffer.from('RIFFtestWEBP');
  const store = createImageStore(r2env, { async send(command) {
    calls.push(command);
    return command.constructor.name === 'GetObjectCommand' ? { ContentType: 'image/webp', ContentLength: bytes.length, Body: { async transformToByteArray() { return bytes; } } } : {};
  } });
  const result = await store.upload(bytes);
  assert.match(result.url, /^\/media\/[a-f0-9-]{36}\.webp$/);
  assert.deepEqual(Object.keys(result), ['url']);
  assert.equal(calls[0].input.Bucket, 'lebron-catalogo');
  assert.equal(calls[0].input.Key, 'catalogo/' + result.url.slice(7));
  assert.equal(calls[0].input.ContentType, 'image/webp');
  assert.equal(calls[0].input.IfNoneMatch, '*');
  assert.deepEqual((await store.read(result.url.slice(7))).bytes, bytes);
  for (const key of ['../comprobantes/private.pdf', 'comprobantes/private.pdf', '.env', 'test.svg', '']) {
    await assert.rejects(store.read(key), error => error.status === 404);
  }
  assert.equal(calls.length, 2);
});

test('Errores de R2 no exponen credenciales ni cambian al modo local silenciosamente', async () => {
  const store = createImageStore(r2env, { async send() { throw new Error(r2env.R2_SECRET_ACCESS_KEY); } });
  await assert.rejects(store.upload(Buffer.from('data')), error => error.status === 502 && !error.message.includes(r2env.R2_SECRET_ACCESS_KEY));
  await assert.rejects(store.read('33333333-3333-4333-8333-333333333333.webp'), error => error.status === 502);
  const missing = createImageStore({ NODE_ENV: 'production' });
  assert.equal(missing.mode, 'r2'); assert.equal(missing.ready, false);
  await assert.rejects(missing.upload(Buffer.from('data')), error => error.status === 503);
  const missingObject = createImageStore(r2env, { async send() { throw Object.assign(new Error(), { name: 'NoSuchKey' }); } });
  await assert.rejects(missingObject.read('33333333-3333-4333-8333-333333333333.webp'), error => error.status === 404);
});

test('La ruta pública de imágenes solo permite GET/HEAD y fotos del catálogo de R2', async t => {
  const reads = [];
  const f = await testApp(t, { imageStore: createImageStore(r2env, { async send(command) {
    reads.push(command.input.Key);
    return { ContentType: 'image/webp', ContentLength: 4, Body: { async transformToByteArray() { return Buffer.from('test'); } } };
  } }) });
  const path = '/media/33333333-3333-4333-8333-333333333333.webp';
  const response = await fetch(f.origin + path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.match(response.headers.get('cache-control'), /immutable/);
  assert.equal(await response.text(), 'test');
  const head = await fetch(f.origin + path, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await fetch(f.origin + path, { method: 'POST' })).status, 405);
  assert.equal((await fetch(f.origin + '/media/private.pdf')).status, 404);
  assert.deepEqual(reads, ['catalogo/' + path.slice(7), 'catalogo/' + path.slice(7)]);
});

test('Resend envía el código por el servidor y nunca incluye su clave en los errores públicos', async () => {
  const env = { MAIL_PROVIDER: 'resend', MAIL_FROM: 'LeBron <sender@example.com>', RESEND_API_KEY: 'test-private-key' };
  let sent;
  const mailer = createMailer(env, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization, 'Bearer test-private-key');
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'mail-123' }), { status: 200 });
  });
  assert.equal(mailer.ready, true);
  await mailer.send({ to: 'owner@example.com', subject: 'Code', text: 'Code: 12345678' });
  assert.deepEqual(sent, { from: env.MAIL_FROM, to: ['owner@example.com'], subject: 'Code', text: 'Code: 12345678' });
  const failing = createMailer(env, async () => { throw new Error(env.RESEND_API_KEY); });
  await assert.rejects(failing.send({ to: 'owner@example.com' }), error => error.status === 503 && !error.message.includes(env.RESEND_API_KEY));
  assert.equal(createMailer({}).ready, false);
});

test('Un objeto R2 con un tipo o tamaño inesperado no se publica como imagen', async () => {
  const store = createImageStore(r2env, { async send() {
    return { ContentType: 'text/html', ContentLength: 100, Body: { destroy() {} } };
  } });
  await assert.rejects(store.read('33333333-3333-4333-8333-333333333333.webp'), error => error.status === 502);
});
