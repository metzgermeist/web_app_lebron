# Lebron: cambios realizados y tareas pendientes

Fecha de actualización: 14 de octubre de 2026.

## Estado actual

El código incorpora la administración propia del catálogo, pedidos por WhatsApp,
verificación del administrador por correo y almacenamiento de imágenes en
Cloudflare R2. El fondo general del sitio quedó negro.

La integración de R2 y del correo está implementada y probada con servicios
simulados. **Todavía no está activada con las cuentas reales.** No se creó el
bucket ni se configuraron credenciales de envío de correo o de R2.

Este documento registra el estado del código; el commit y el push no despliegan
la aplicación ni configuran los servicios externos.

## Cambios realizados

### Fondo del sitio

- Fondo general negro puro (`#000000`).
- Eliminación del degradado rojizo del fondo global.
- Se conservaron las estrellas y los detalles rojos de la identidad visual.

Archivos principales: `assets/css/styles.css` y `assets/css/atomicos/fondos.css`.

### Catálogo y pedidos

- Catálogo servido por una API Node.js con SQLite persistente.
- Panel `/admin` para crear y editar productos, precios, stock y variantes.
- Publicación y ocultamiento de productos y selección de destacados.
- Importación CSV con vista previa, validación e importación atómica; exportación
  para utilizar como plantilla.
- Catálogo compartido entre las páginas de la tienda y actualización periódica.
- Carrito que conserva variantes, respeta el stock compartido y se ajusta cuando
  cambia el catálogo.
- Nueva consulta del catálogo antes de abrir el pedido en WhatsApp.
- Resumen con productos, cantidades, opciones, medio de pago, entrega y contacto.

La compra se coordina por WhatsApp con Casa Central. El sitio no procesa pagos,
no confirma ventas automáticamente y no descuenta ni reserva stock al abrir el chat.

### Acceso administrativo

- Se quitó el enlace público «Administrar catálogo» del footer.
- El administrador entra directamente a `/admin` y puede guardar la dirección en
  favoritos. La ruta sigue siendo accesible; la protección está en la autenticación.
- El alta inicial requiere el código de instalación de la terminal, usuario,
  contraseña y verificación del correo.
- El correo autorizado quedó fijado localmente en `.env` como
  `javiermas.unt@gmail.com`, mediante `ADMIN_EMAIL`.
- La cuenta nueva no se crea ni se activa hasta verificar el correo.
- Cada ingreso posterior requiere usuario, contraseña y un código enviado por correo.
- Se agregaron recuperación de contraseña y cambio desde el panel.
- Si ya existía un administrador, conserva su usuario, contraseña y catálogo,
  pero debe vincular y verificar su correo. Las sesiones anteriores a esta
  actualización se revocan al ejecutar la migración.

La configuración local de `.env` no viaja con Git. En el alojamiento hay que
configurar `ADMIN_EMAIL` y las demás variables privadas nuevamente.

### Medidas de seguridad

- Contraseñas protegidas con scrypt y sesiones almacenadas mediante hashes.
- Códigos de correo de 8 dígitos, de un solo uso, con vencimiento de 10 minutos
  y hasta 5 intentos. No se imprimen los códigos de correo en la terminal.
- Límites persistentes de intentos y envíos; hasta 3 códigos por correo cada
  15 minutos.
- Sesiones con duración máxima de 2 horas y vencimiento tras 30 minutos sin
  actividad. Un nuevo ingreso verificado cierra la sesión anterior.
- Recuperar o cambiar la contraseña invalida sesiones y códigos pendientes.
- Cookies HttpOnly y SameSite; en producción se utilizan Secure y el prefijo
  `__Host-`.
- Comprobación del origen de las solicitudes que modifican datos.
- Cabeceras de protección, CSP y HSTS en producción, y desindexación de `/admin`.
- Consultas parametrizadas, límites de solicitudes y restricciones de archivos.
- Las cabeceras de IP solo se aceptan desde proxies configurados explícitamente.
- Actualización de una dependencia con una vulnerabilidad reportada por npm.

La verificación por correo agrega protección, pero no equivale a autenticación
resistente al phishing mediante llaves de seguridad. Las pruebas realizadas no
constituyen una auditoría independiente ni garantizan la seguridad del alojamiento.

### Imágenes: decisión final y funcionamiento

Se evaluó Cloudinary. Después se revisaron las copias locales del sistema de
Alianzas y se encontró que utiliza **Cloudflare R2**, no Firebase. Se decidió usar
la misma tecnología con un bucket y credenciales exclusivos de Lebron.

No se copiaron credenciales de Alianzas: los campos de claves estaban vacíos en
sus archivos locales. Tampoco se modificó ese sistema ni su almacenamiento.

El flujo implementado es:

1. El administrador selecciona la imagen en el panel, como antes.
2. El servidor comprueba la sesión y valida completamente el archivo.
3. La imagen se decodifica, se eliminan metadatos y se convierte a WebP.
4. El servidor la sube al bucket privado de Lebron.
5. La dirección `/media/<uuid>.webp` permite mostrarla en la tienda.
6. El administrador guarda el producto con esa dirección.

Se admiten PNG, JPG y WebP de hasta 5 MB y 24 megapíxeles. La imagen resultante
tiene como máximo 2400 × 2400 píxeles. Se rechazan imágenes dañadas, falsificadas
o animadas.

El bucket puede permanecer privado: el servidor entrega únicamente imágenes
del catálogo con nombres válidos, sin publicar claves ni permitir listar el bucket.
Las fotos servidas por `/media/` son públicas; ese bucket no debe contener
comprobantes ni documentos privados de Alianzas.

Las imágenes locales existentes siguen funcionando y no se migraron ni borraron.
Sin configuración externa, el desarrollo mantiene almacenamiento local. En
producción se espera R2 para las nuevas subidas, salvo selección explícita de
`IMAGE_STORAGE=local` con disco persistente.

## Qué falta hacer

### 1. Activar Cloudflare R2

- [ ] Acceder a la cuenta de Cloudflare que se va a utilizar.
- [ ] Crear un bucket privado exclusivo, por ejemplo `lebron-catalogo`.
- [ ] Generar credenciales S3 de lectura/escritura limitadas a ese bucket.
- [ ] Configurar las variables privadas `IMAGE_STORAGE=r2`, `R2_ACCOUNT_ID`,
  `R2_BUCKET`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.
- [ ] Reiniciar la aplicación, subir una foto real, guardar el producto y verificar
  que la imagen se vea tanto en el panel como en la tienda.

No reutilizar el bucket ni las claves de comprobantes de Alianzas. No hace falta
habilitar acceso público directo al bucket, CORS ni un dominio de imágenes para
el flujo implementado.

### 2. Configurar el envío de correo

- [ ] Elegir SMTP o Resend como servicio de envío.
- [ ] Configurar `ADMIN_EMAIL` también en el alojamiento.
- [ ] Para SMTP, configurar `MAIL_PROVIDER=smtp`, `MAIL_FROM`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD`.
- [ ] Si se utiliza Gmail, usar una contraseña de aplicación cuando la cuenta lo
  admita; no utilizar la contraseña habitual del correo.
- [ ] Como alternativa, configurar `MAIL_PROVIDER=resend`, `MAIL_FROM` y
  `RESEND_API_KEY`, con el remitente habilitado por ese proveedor.
- [ ] Reiniciar y comprobar la recepción real de los códigos, incluyendo Spam.
- [ ] Verificar el alta o vinculación del administrador, un ingreso posterior,
  recuperación y cambio de contraseña.

**Hasta configurar el envío, el nuevo acceso administrativo no permite entrar.**
El catálogo público puede seguir funcionando. No hay una opción para omitir la
verificación del correo.

### 3. Preparar el despliegue

- [ ] Usar Node.js 24 o superior y alojamiento con disco persistente para SQLite.
- [ ] Configurar HTTPS y `NODE_ENV=production`.
- [ ] Definir `PUBLIC_ORIGIN` con el origen HTTPS exacto y sin barra final.
- [ ] Definir `DATA_DIR`, `HOST` y `PORT` según el alojamiento y usar una sola
  instancia para esta base SQLite.
- [ ] Si existe un proxy, hacer que sobrescriba `X-Real-IP`, restringir el acceso
  directo a Node y recién entonces configurar `TRUSTED_PROXY_IPS`.
- [ ] Configurar los límites de tráfico del alojamiento o CDN.
- [ ] Ejecutar `npm run build` y servir la aplicación completa con `npm start`.
- [ ] Probar catálogo, carrito, pedido por WhatsApp, acceso y carga de imágenes
  desde el dominio definitivo.

GitHub Pages no ejecuta la API Node ni SQLite. `docs/index.html` y `docs/assets/`
conservan el sitio estático anterior; no representan la aplicación actual. La
salida de compilación vigente es `dist/`.

### 4. Respaldos y mantenimiento

- [ ] Conservar una copia externa de SQLite y de las imágenes locales, además de
  las copias automáticas que genera el servidor.
- [ ] Definir y comprobar un respaldo separado del bucket R2: `npm run backup`
  no descarga las imágenes alojadas allí.
- [ ] Planificar, si se desea, la migración de imágenes locales antiguas a R2.
- [ ] Revisar periódicamente imágenes sin uso, almacenamiento y dependencias.

No se implementó borrado automático de imágenes en R2 para evitar eliminar fotos
todavía referenciadas. Las subidas canceladas pueden dejar archivos sin usar.

## Validaciones realizadas

En la implementación se aprobaron:

- `npm test`: 28 pruebas.
- `npm run lint`: sin errores.
- `npm run build`: compilación correcta.
- `npm audit --omit=dev`: sin vulnerabilidades conocidas reportadas en producción.

Las pruebas cubren catálogo, persistencia, CSV, carrito, mensajes de WhatsApp,
sesiones, verificación y recuperación por correo, migración del administrador,
códigos vencidos y reutilizados, bloqueo de intentos, origen de solicitudes,
cabeceras, imágenes inválidas y acceso restringido al bucket de Lebron.

Las pruebas de proveedores usan clientes simulados. Queda pendiente verificar
una subida real a R2 y un envío real de correo con las credenciales definitivas.
La herramienta de control del navegador se detuvo porque no pudo verificar la
URL actual; no se creó infraestructura externa desde esa sesión.

## Archivos de referencia

- `README.md`: instalación, configuración, despliegue y operación.
- `.env.example`: nombres de variables y ejemplos sin credenciales reales.
- `server/app.mjs`: API, SQLite, imágenes y respaldos.
- `server/auth.mjs`: acceso, correo verificado y contraseñas.
- `server/security.mjs`: límites, proxies y cabeceras.
- `server/services.mjs`: SMTP/Resend, validación de imágenes y R2.
- `src/pages/Admin.jsx` y `src/pages/AdminAccess.jsx`: panel e ingreso.
- `server/*.test.mjs` y `src/utils/*.test.mjs`: verificaciones automatizadas.

No guardar `.env`, claves, contraseñas, códigos, bases SQLite, respaldos ni
documentos privados en Git. Esos datos no forman parte del commit del proyecto.
