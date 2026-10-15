import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';
import { testMailer } from './test-support.mjs';
import sharp from 'sharp';

test('Catálogo persistente, acceso privado, publicación, importación y sesiones', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'lebron-api-'));
  const mailer = testMailer();
  const options = { dataDir, seed:true, secureCookies:false, mailer, imageStore:{ mode:'local' }, ownerEmail:null, trustedProxies:[] };
  let app = createApp(options);
  let origin, cookie='';
  const start = async () => {
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
    origin = `http://127.0.0.1:${app.server.address().port}`;
  };
  const stop = () => new Promise(resolve => app.server.close(resolve));
  async function call(route, method='GET', input, authenticated=true, extraHeaders={}) {
    const response = await fetch(origin+route, { method, headers:{ 'Content-Type':'application/json',
      ...(authenticated && cookie ? { Cookie:cookie } : {}), ...extraHeaders }, body:input ? JSON.stringify(input) : undefined });
    const data = await response.json(); return { response,data };
  }
  await start();
  try {
    let result = await call('/api/catalogo/productos');
    assert.equal(result.data.length,40);
    assert.equal((await call('/api/admin/products')).response.status,401);
    assert.equal((await call('/api/admin/setup','POST',{ token:'wrong',username:'admin',password:'testing-password-123' })).response.status,403);
    result = await call('/api/admin/setup','POST',{ token:app.setupToken,username:'admin',email:'owner@example.com',password:'testing-password-123' });
    assert.equal(result.response.status,202);
    assert.equal((await call('/api/admin/products')).response.status,401);
    result = await call('/api/admin/verify','POST',{challengeId:result.data.challengeId,code:mailer.code()});
    assert.equal(result.response.status,200);
    const setCookie = result.response.headers.get('set-cookie');
    assert.match(setCookie,/HttpOnly/); assert.match(setCookie,/SameSite=Strict/);
    cookie = setCookie.split(';')[0];
    assert.equal((await call('/api/admin/setup','POST',{ token:app.setupToken,username:'other',password:'testing-password-123' })).response.status,403);
    assert.equal((await call('/api/admin/products','POST',{},true,{ Origin:'https://untrusted.example' })).response.status,403);
    const draft = { nombre:'Producto de prueba',categoria:'Nueva categoría',marca:'Nueva marca',precio:100,stock:4,
      visible:false,disponible:true,tamanos:['1kg'],sabores:['Chocolate'],preciosPorTamano:{ '1kg':90 } };
    result = await call('/api/admin/products','POST',draft);
    assert.equal(result.response.status,201);
    const product=result.data;
    assert.equal((await call('/api/catalogo/productos')).data.length,40);
    assert.equal((await call('/api/admin/products')).data.length,41);
    result=await call(`/api/admin/products/${product.id}`,'PUT',{...product,visible:true});
    assert.equal(result.response.status,200);
    assert.equal((await call('/api/catalogo/productos')).data.find(item=>item.id===product.id).preciosPorTamano['1kg'],90);
    assert.equal((await call('/api/admin/import','POST',{ products:[{...product,precio:50},{...product,id:'invalid',stock:-1}] })).response.status,400);
    assert.equal((await call('/api/admin/products')).data.find(item=>item.id===product.id).precio,100);
    assert.equal((await call('/api/admin/import','POST',{ products:[{...product,precio:50}],preview:true })).response.status,200);
    assert.equal((await call('/api/admin/products')).data.find(item=>item.id===product.id).precio,100);
    assert.equal((await call('/api/admin/import','POST',{ products:[{...product,precio:50}],preview:false })).response.status,200);
    assert.equal((await call('/api/admin/uploads','POST',{data:'data:image/svg+xml;base64,PHN2Zz4='})).response.status,400);
    const png=(await sharp({create:{width:2,height:2,channels:3,background:'#ff0000'}}).png().toBuffer()).toString('base64');
    result=await call('/api/admin/uploads','POST',{data:`data:image/png;base64,${png}`});
    assert.equal(result.response.status,201);
    const uploadUrl=result.data.url;
    const image=await fetch(origin+uploadUrl); assert.equal(image.status,200); assert.equal(image.headers.get('content-type'),'image/webp');
    const backup=await app.makeBackup(); assert.ok(fs.statSync(backup).size>0);
    await stop();
    app=createApp(options); await start();
    assert.equal(app.setupToken,null);
    result=await call('/api/admin/products');
    assert.equal(result.data.length,41);
    assert.equal(result.data.find(item=>item.id===product.id).precio,50);
    assert.equal((await fetch(origin+uploadUrl)).status,200);
    await call('/api/admin/logout','POST',{});
    assert.equal((await call('/api/admin/products')).response.status,401);
    assert.equal((await call('/api/admin/login','POST',{username:'admin',password:'wrong'})).response.status,401);
    result=await call('/api/admin/login','POST',{username:'admin',password:'testing-password-123'});
    assert.equal(result.response.status,202);
    assert.equal((await call('/api/admin/products')).response.status,401);
    result=await call('/api/admin/verify','POST',{challengeId:result.data.challengeId,code:mailer.code()});
    assert.equal(result.response.status,200);
    for(let i=0;i<10;i++) await call('/api/admin/login','POST',{username:'admin',password:'wrong'});
    assert.equal((await call('/api/admin/login','POST',{username:'admin',password:'wrong'})).response.status,429);
  } finally {
    await stop();
    // Directorio temporal exclusivo del test, fuera de los datos de la aplicación.
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
});
