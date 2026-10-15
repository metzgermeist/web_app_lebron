# LeBron: tienda y administración propia

Estado de los cambios y tareas pendientes: [informe del 14 de octubre de 2026](docs/ESTADO_PROYECTO_2026-10-14.md).

La tienda consulta su propio catálogo por API. El panel `/admin` permite crear y
editar productos, publicar u ocultar, marcar destacados y disponibilidad, administrar
precios por tamaño y opciones, subir fotos e importar/exportar CSV. La compra se
coordina por WhatsApp con Casa Central; no se procesan pagos ni se registra una venta
automáticamente al abrir el chat.

## Iniciar en tu computadora

Requiere **Node.js 24 o superior** y npm.

```sh
npm install
npm run dev
```

Abrí la dirección indicada por Vite (normalmente `http://127.0.0.1:5173`).
El mismo comando inicia la API en el puerto 3001. No hace falta iniciar dos terminales.

Antes del primer ingreso configurá el servicio de correo en `.env` (ver abajo).
No hay un modo que muestre códigos de correo en la terminal ni permita omitir la verificación.

1. Entrá directamente a `/admin` y guardá la dirección en favoritos. No hay enlace público en el footer.
2. La primera vez, copiá el **código de instalación** que muestra la terminal.
3. Elegí tu usuario, correo y una contraseña de al menos 12 caracteres.
4. Confirmá el código de 8 dígitos recibido por correo. Recién entonces se crea y activa la cuenta.
5. En adelante ingresás con usuario, contraseña y un código nuevo enviado a tu correo.

No hay contraseña predeterminada. Reiniciar el servidor antes de completar la
instalación genera otro código. Después de crear la cuenta, no se permite registrar
otros administradores desde el formulario de instalación.

Si ya existía un administrador, se conservan su usuario, contraseña y catálogo.
La primera ejecución de esta versión cierra las sesiones antiguas. Después de
ingresar la contraseña se pide vincular y verificar un correo antes de habilitar el panel.

Los códigos duran 10 minutos, admiten 5 intentos y se guardan como hashes. No se
pueden reutilizar. Una nueva sesión cierra la anterior; las sesiones duran hasta
2 horas y vencen tras 30 minutos sin actividad. Los límites de intentos y envíos
persisten en SQLite aunque se reinicie el servidor (hasta 3 códigos por correo
cada 15 minutos). El correo agrega una comprobación adicional, pero no equivale
a un segundo factor resistente al phishing como una llave de seguridad.

«Olvidé mi contraseña» permite recuperarla con un código enviado al correo ya
verificado. El panel permite cambiarla con la contraseña actual. Ambos cambios
cierran todas las sesiones, invalidan códigos pendientes y envían un aviso.

## Correo del administrador

El correo del dueño de esta instalación es `javiermas.unt@gmail.com`. Para fijarlo
como único correo permitido al crear o vincular la cuenta, configurá:

```dotenv
ADMIN_EMAIL=javiermas.unt@gmail.com
```

`ADMIN_EMAIL` no modifica silenciosamente el correo de una cuenta ya verificada.
Para el envío elegí **una** de estas opciones en `.env`:

```dotenv
# Resend: remitente de un dominio verificado en tu cuenta
MAIL_PROVIDER=resend
MAIL_FROM=LeBron <acceso@tu-dominio.com>
RESEND_API_KEY=tu-clave
```

```dotenv
# SMTP: también sirve Gmail con una contraseña de aplicación, si la cuenta lo admite
MAIL_PROVIDER=smtp
MAIL_FROM=LeBron <tu-correo@ejemplo.com>
SMTP_HOST=smtp.ejemplo.com
SMTP_PORT=465
SMTP_USER=tu-correo@ejemplo.com
SMTP_PASSWORD=tu-credencial-smtp
```

SMTP usa TLS en el puerto 465 o exige STARTTLS en 587. Para Gmail el host es
`smtp.gmail.com`; no se debe usar la contraseña habitual de la cuenta.
Las claves se configuran en `.env` o en las variables privadas del alojamiento,
sin prefijo `VITE_`, y nunca se guardan en Git ni en el navegador. Sin un servicio
de correo configurado el catálogo público funciona, pero no se puede omitir la
verificación para entrar al panel. Si no llega el correo, revisá Spam y la
configuración del proveedor antes de volver a pedirlo.

## Imágenes en Cloudflare R2

Se utiliza la misma tecnología de Alianzas, con un **bucket privado exclusivo de
Lebron** y un token S3 de lectura/escritura limitado a ese bucket. No reutilizar
el bucket ni las claves de los comprobantes privados de Alianzas. Las claves de
Alianzas no se encontraron en sus archivos locales de configuración.

```dotenv
IMAGE_STORAGE=r2
R2_ACCOUNT_ID=identificador-de-tu-cuenta
R2_BUCKET=lebron-catalogo
R2_ACCESS_KEY_ID=tu-access-key
R2_SECRET_ACCESS_KEY=tu-secret-key
```

Creá el bucket y el token en Cloudflare y mantené deshabilitado el acceso público
directo. No hace falta configurar CORS ni un dominio de imágenes: el servidor
sube las imágenes y las sirve mediante `/media/<uuid>.webp`. Esta ruta es pública,
solo admite nombres de fotos del catálogo y no permite listar o leer otros
archivos del bucket. Usá este bucket exclusivamente para fotos públicas.

La carga desde el panel conserva el mismo funcionamiento: elegís una foto, el
servidor la decodifica, limita a 24 megapíxeles, elimina metadatos y genera WebP
de hasta 2400 × 2400 antes de subirla. Se rechazan archivos falsificados, dañados,
animados o de más de 5 MB. Una falla de R2 se muestra en el editor y no cambia la
foto del producto por una URL inválida. Guardá el producto después de subirla.

Las fotos locales existentes siguen funcionando. No se migran ni se borran
automáticamente. Las copias locales de seguridad contienen SQLite e imágenes
locales; **no descargan el contenido de R2**. El respaldo de ese bucket se gestiona
por separado. Las subidas canceladas pueden dejar fotos sin usar: no se hace
borrado automático para evitar eliminar imágenes todavía referenciadas.

En desarrollo, sin configuración de R2, se conserva el almacenamiento local.
En producción se espera R2 para nuevas subidas; para elegir disco persistente
explícitamente se puede usar `IMAGE_STORAGE=local`.

## Administrar productos

- **Nuevo producto / Editar:** nombre, categoría, marca, descripción, precio base,
  stock e imagen. Podés escribir una categoría o marca nueva directamente.
- **Mostrar en el sitio:** controla la publicación en todos los listados y el
  detalle. Ocultar conserva los datos para volver a publicar más adelante.
- **Disponible para pedidos:** permite dejar visible un producto sin admitir
  que se agregue al carrito. Con stock cero tampoco se puede agregar.
- **Destacado:** aparece en la sección de destacados del inicio.
- **Opciones:** tamaños, sabores, versiones, colores y materiales separados por comas.
  Los tamaños admiten un precio específico; si queda vacío se usa el precio base.
- **Stock:** es del producto y se comparte entre opciones. El panel no constituye
  un sistema de inventario de ventas: las ventas confirmadas por WhatsApp se actualizan
  manualmente aquí. No descuenta ni reserva stock al abrir WhatsApp.
- **Fotos:** se acepta URL HTTP(S) o carga de PNG/JPG/WebP de hasta 5 MB.

Los 40 productos de `src/data/productos.json` se importan **una sola vez**, al crear
la base de datos. Modificar ese JSON después no cambia el catálogo. Todas las ediciones
posteriores se hacen desde el panel. Las imágenes antiguas que no existan conservan
el reemplazo visual de la tienda; podés sustituirlas desde el editor.

El catálogo se actualiza al abrir el sitio, al volver a la pestaña y cada minuto
si está visible. Guardar desde el panel actualiza la tienda en esa misma pestaña.
Antes de abrir WhatsApp se consulta otra vez el catálogo. Si cambiaron precios,
opciones o disponibilidad, el carrito se ajusta y pide revisar el nuevo resumen.
Los datos de contacto y el medio de pago del cliente siguen siendo libres: la API
no valida un pago.

## Importación masiva

1. Exportá el catálogo como CSV desde el panel. Es también la plantilla.
2. Abrilo en una planilla usando UTF-8 y separador **punto y coma**.
3. Conservá `id` para actualizar un producto; dejalo vacío para crear uno.
4. Usá `true` / `false` para `visible`, `disponible` y `destacado`.
5. Separá opciones con `|`, por ejemplo `Chocolate|Vainilla`.
6. `preciosPorTamano` usa JSON, por ejemplo `{"1kg":31500,"2kg":56200}`.
7. Importá el archivo, revisá la lista y presioná **Confirmar importación**.

No se borra ningún producto por faltar en el CSV. Una importación con datos inválidos
se rechaza completa. Máximo 500 filas / 5 MB. Se admite también CSV separado por comas.
Para archivos nuevos sin flags, los productos quedan ocultos hasta publicarlos.
El panel importa CSV, no archivos XLSX: exportá la planilla a CSV UTF-8 primero.

## Datos y copias de seguridad

Por defecto todo se guarda fuera del repositorio, en `.data/` (ignorado por Git):

```text
.data/catalog.sqlite        Productos, usuario y sesiones
.data/uploads/             Imágenes cargadas
.data/backups/<fecha>/      Copia de SQLite e imágenes
```

El servidor hace una copia al iniciar y cada 24 horas mientras está encendido.
En desarrollo se realiza al iniciar. También podés ejecutar `npm run backup`.
Las copias se conservan; controlá el espacio disponible y copiá periódicamente un
respaldo a otro disco/servicio. Una copia en el mismo disco no protege contra su pérdida.

Para restaurar: detené **todos** los procesos del proyecto, conservá la carpeta
de datos actual con otro nombre, creá una carpeta de datos nueva y copiá dentro
`catalog.sqlite` y `uploads/` del respaldo. Arrancá usando esa carpeta como `DATA_DIR`.
No mezcles un respaldo con archivos SQLite `-wal` / `-shm` de otra ejecución.

## Publicar el sistema

```sh
npm run build
npm start
```

El servidor sirve `dist/`, la API y las imágenes desde el mismo dominio. Probalo
localmente en `http://127.0.0.1:3001`. `npm run preview` muestra sólo el frontend;
para probar la aplicación completa después de compilar usá `npm start`.

Para producción, copiá `.env.example` como `.env` y configurá:

```dotenv
NODE_ENV=production
PUBLIC_ORIGIN=https://tu-dominio.com
HOST=127.0.0.1
PORT=3001
DATA_DIR=/ruta/persistente/lebron
```

Necesita un servidor Node con **disco persistente** y HTTPS mediante proxy inverso.
Si el alojamiento necesita escuchar fuera de localhost, configurá `HOST=0.0.0.0`.
`PUBLIC_ORIGIN` debe coincidir exactamente con el origen del navegador, sin barra final.
En producción las cookies requieren HTTPS. Usá una sola instancia con esta base SQLite.

El servidor aplica HSTS y una política CSP en producción, rechaza modificaciones
sin un origen válido y usa cookies `__Host-` HttpOnly/Secure/SameSite. `/admin`
envía `noindex`; ocultar el enlace o desindexarlo no sustituye la autenticación.

Si hay un proxy inverso, debe sobrescribir `X-Real-IP` con la IP real del cliente
y restringir el acceso directo al puerto Node. Recién entonces definí
`TRUSTED_PROXY_IPS` con las IP exactas del proxy inmediato. Por defecto no se
confía en cabeceras de IP enviadas por visitantes. No activar esta opción sin
verificar la configuración del alojamiento: hacerlo mal permite evadir límites;
dejarla sin configurar puede agrupar visitantes bajo la IP del proxy.
Usá los límites de tráfico del alojamiento/CDN para protección volumétrica.

GitHub Pages y otros alojamientos exclusivamente estáticos no ejecutan esta API.
La carpeta `docs/` conserva el sitio antiguo y ya no es la salida de compilación.
No subas `.data` como archivos públicos. La aplicación actual usa la raíz del dominio,
no el prefijo anterior `/web_app_lebron/`.

## Estructura y verificación

- `server/app.mjs`: API, acceso privado, SQLite, imágenes y copias.
- `server/catalog.mjs`: validación del catálogo de administración.
- `server/auth.mjs`: correo verificado, acceso por código y recuperación.
- `server/security.mjs`: límites persistentes, IP confiable y cabeceras.
- `server/services.mjs`: SMTP/Resend, validación de imágenes y almacenamiento R2.
- `src/context/CatalogContext.jsx`: datos compartidos de la tienda.
- `src/pages/Admin.jsx`: panel de administración.
- `src/utils/catalogCsv.js`: importación y exportación.

```sh
npm test
npm run build
```

Las pruebas cubren sesión, publicación, persistencia, importación atómica, imágenes,
CSV, carrito actualizado y mensajes de WhatsApp. La API usa el módulo integrado
[`node:sqlite`](https://nodejs.org/api/sqlite.html), con consultas parametrizadas;
las contraseñas se guardan con scrypt y las sesiones con cookies HttpOnly.
Las pruebas adicionales cubren códigos vencidos/reutilizados, bloqueo de intentos,
recuperación, migración del administrador, revocación de sesiones, CSRF, cabeceras,
archivos falsificados y almacenamiento R2 con un cliente simulado. Estas pruebas
no sustituyen una prueba real con las credenciales del proveedor ni una auditoría
independiente de la aplicación y su alojamiento.
