import { createApp } from '../server/app.mjs';
const app = createApp();
try { console.log(`Copia guardada: ${await app.makeBackup()}`); }
finally { app.server.emit('close'); }
