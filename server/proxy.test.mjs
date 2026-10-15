import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import config from '../vite.config.js';
import { createApp } from './app.mjs';
import { testMailer } from './test-support.mjs';

test('El panel puede crear la cuenta e ingresar a través del proxy sin permitir orígenes externos', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lebron-proxy-'));
  const mailer = testMailer();
  const app = createApp({ dataDir, seed:false, secureCookies:false, mailer, ownerEmail:null, trustedProxies:[] });
  let vite, proxy;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    vite = await createServer({ configFile:false, logLevel:'silent', server:{
      middlewareMode:true, hmr:false, proxy:{ '/api':{
        ...config.server.proxy['/api'], target:`http://127.0.0.1:${app.server.address().port}`,
      } },
    } });
    proxy = http.createServer(vite.middlewares);
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${proxy.address().port}`;
    const credentials = { username:'admin', email:'owner@example.com', password:'test-proxy-password-123' };
    const post = (route, input, source = origin) => fetch(`${origin}/api/admin/${route}`, {
      method:'POST', headers:{ 'Content-Type':'application/json', Origin:source,
        'Sec-Fetch-Site':source === origin ? 'same-origin' : 'cross-site' },
      body:JSON.stringify(input),
    });
    const setup = await post('setup', { ...credentials, token:app.setupToken });
    assert.equal(setup.status, 202);
    let verified = await post('verify', { challengeId:(await setup.json()).challengeId, code:mailer.code() });
    assert.equal(verified.status, 200);
    let login = await post('login', credentials);
    assert.equal(login.status, 202);
    verified = await post('verify', { challengeId:(await login.json()).challengeId, code:mailer.code() });
    login = verified;
    assert.equal(login.status, 200, await login.text());
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const products = await fetch(`${origin}/api/admin/products`, { headers:{ Cookie:cookie } });
    assert.equal(products.status, 200);
    const external = await post('login', credentials, 'https://untrusted.example');
    assert.equal(external.status, 403);
  } finally {
    if (proxy) await new Promise(resolve => proxy.close(resolve));
    if (vite) await vite.close();
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dataDir, { recursive:true, force:true });
  }
});
