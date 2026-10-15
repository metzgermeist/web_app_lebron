import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';

export function testMailer() {
  const messages = [];
  return { ready: true, messages, async send(message) { messages.push(message); },
    code() { return messages.findLast(message => /\b\d{8}\b/.test(message.text))?.text.match(/\b\d{8}\b/)[0]; } };
}

export async function testApp(t, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lebron-security-'));
  const mailer = testMailer();
  const app = createApp({ dataDir, seed: false, secureCookies: false, publicOrigin: undefined,
    ownerEmail: null, trustedProxies: [], imageStore: { mode: 'local' }, mailer, ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  let cookie = '';
  async function call(route, input, { authenticated = true, headers = {}, method = input === undefined ? 'GET' : 'POST' } = {}) {
    const response = await fetch(origin + '/api/admin/' + route, { method,
      headers: { 'Content-Type': 'application/json', Origin: options.publicOrigin || origin, ...(authenticated && cookie ? { Cookie: cookie } : {}), ...headers },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const data = await response.json();
    return { response, data };
  }
  async function verify(result) {
    const checked = await call('verify', { challengeId: result.data.challengeId, code: mailer.code() });
    if (checked.response.headers.get('set-cookie')) cookie = checked.response.headers.get('set-cookie').split(';')[0];
    return checked;
  }
  async function setup() {
    return verify(await call('setup', { username: 'admin', email: 'owner@example.com', password: 'testing-password-123', token: app.setupToken }));
  }
  return { app, dataDir, mailer, origin, call, verify, setup, get cookie() { return cookie; } };
}
