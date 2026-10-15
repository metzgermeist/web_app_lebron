import { createServer } from 'vite';
import { createApp } from '../server/app.mjs';
const app = createApp({ secureCookies:false });
await new Promise((resolve,reject) => { app.server.once('error',reject); app.server.listen(3001, '127.0.0.1', resolve); });
const vite = await createServer();
await vite.listen(); vite.printUrls();
if (app.setupToken) console.log(`Código de instalación para /admin (único uso): ${app.setupToken}`);
app.makeBackup().catch(console.error);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await vite.close(); app.server.close(); });
