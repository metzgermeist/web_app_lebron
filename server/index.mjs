import { createApp } from './app.mjs';
const app = createApp();
const port = Number(process.env.PORT || 3001);
app.server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`LeBron: http://localhost:${port}/admin`);
  if (app.setupToken) console.log(`Código de instalación (único uso): ${app.setupToken}`);
});
const backupTimer = setInterval(() => app.makeBackup().catch(console.error), 24 * 3600_000);
backupTimer.unref();
app.makeBackup().catch(console.error);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  clearInterval(backupTimer); app.server.close();
});
