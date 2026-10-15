import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
import { HttpError } from './catalog.mjs';

// Secrets are read only by Node. Never use a VITE_ prefix for these settings.
export function createMailer(env = process.env, fetcher = fetch) {
  const from = env.MAIL_FROM;
  const provider = env.MAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : 'smtp');
  let transport;
  const ready = Boolean(from && (provider === 'resend' ? env.RESEND_API_KEY
    : provider === 'smtp' && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD));
  if (ready && provider === 'smtp') {
    const port = Number(env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
      tls: { minVersion: 'TLSv1.2' },
    });
  }
  return {
    ready,
    async send({ to, subject, text }) {
      if (!ready) throw new HttpError(503, 'Falta configurar el servicio de correo del administrador.');
      try {
        if (transport) await transport.sendMail({ from, to, subject, text, disableFileAccess: true, disableUrlAccess: true });
        else {
          const response = await fetcher('https://api.resend.com/emails', {
            method: 'POST', signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
            body: JSON.stringify({ from, to: [to], subject, text }),
          });
          if (!response.ok || !(await response.json()).id) throw new Error('Mail rejected');
        }
      } catch {
        // Provider errors can contain credentials, recipient addresses or message content.
        throw new HttpError(503, 'No se pudo enviar el correo. Revisá la configuración e intentá nuevamente.');
      }
    },
  };
}

export async function sanitizeImage(data) {
  const match = typeof data === 'string' && data.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) throw new HttpError(400, 'Subí una imagen PNG, JPG o WebP.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new HttpError(400, 'La imagen no puede superar 5 MB.');
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== match[1].toLowerCase() || (metadata.pages || 1) > 1) throw new Error('Invalid format');
    // Decode the entire image and re-encode it, dropping metadata and any trailing payload.
    const output = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (output.length > 5 * 1024 * 1024) throw new Error('Output too large');
    return output;
  } catch {
    throw new HttpError(400, 'Imagen inválida, dañada, animada o demasiado grande (máximo 24 megapíxeles).');
  }
}

export function createImageStore(env = process.env, client) {
  const configured = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
  const mode = env.IMAGE_STORAGE || (configured || env.NODE_ENV === 'production' ? 'r2' : 'local');
  if (!['local', 'r2'].includes(mode)) throw new Error('IMAGE_STORAGE debe ser local o r2.');
  if (configured && !/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID)) throw new Error('R2_ACCOUNT_ID inválido.');
  const s3 = client || (configured && mode === 'r2' ? new S3Client({
    region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 2,
  }) : null);
  const namePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/;
  function requireStore() {
    if (mode !== 'r2' || !configured || !s3) throw new HttpError(503, 'Falta configurar el almacenamiento R2 de Lebron en el servidor.');
  }
  return {
    mode, ready: mode === 'local' || configured,
    async upload(bytes) {
      requireStore();
      const name = `${randomUUID()}.webp`;
      try {
        await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: `catalogo/${name}`, Body: bytes,
          ContentType: 'image/webp', CacheControl: 'public, max-age=86400, immutable', IfNoneMatch: '*' }),
        { abortSignal: AbortSignal.timeout(30_000) });
        return { url: `/media/${name}` };
      } catch {
        throw new HttpError(502, 'No se pudo subir la imagen a R2. Reintentá; el producto no se modificó.');
      }
    },
    async read(name) {
      // A stable public route exposes only UUID-named catalog images, never arbitrary bucket keys.
      if (!namePattern.test(name)) throw new HttpError(404, 'Imagen no encontrada.');
      requireStore();
      try {
        const result = await s3.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: `catalogo/${name}` }),
          { abortSignal: AbortSignal.timeout(15_000) });
        if (result.ContentType !== 'image/webp' || !result.ContentLength || result.ContentLength > 5 * 1024 * 1024) {
          result.Body?.destroy(); throw new Error('Invalid object');
        }
        return { bytes: await result.Body.transformToByteArray() };
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) throw new HttpError(404, 'Imagen no encontrada.');
        throw new HttpError(502, 'No se pudo cargar la imagen.');
      }
    },
    close() { s3?.destroy?.(); },
  };
}
