import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateProduct(input, id = input?.id) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Producto inválido.');
  const text = (key, max, required = false) => {
    const value = String(input[key] ?? '').trim();
    if ((required && !value) || value.length > max) throw new HttpError(400, `Revisá el campo ${key} (máximo ${max} caracteres).`);
    return value;
  };
  const number = (value, name, integer = false) => {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0
      || Number(value) > 1e9 || (integer && !Number.isInteger(Number(value)))) {
      throw new HttpError(400, `${name} debe ser un número válido mayor o igual a cero.`);
    }
    return Number(value);
  };
  const product = {
    id: String(id || randomUUID()), nombre: text('nombre', 160, true),
    descripcion: text('descripcion', 5000), categoria: text('categoria', 80, true),
    marca: text('marca', 100), precio: number(input.precio, 'Precio'),
    stock: number(input.stock, 'Stock', true), imagen: text('imagen', 2000),
    visible: input.visible === true, disponible: input.disponible !== false,
    destacado: input.destacado === true,
  };
  if (!/^[\w-]{1,100}$/.test(product.id)) throw new HttpError(400, 'Identificador de producto inválido.');
  if (product.imagen && !/^https?:\/\/[^\s]+$/i.test(product.imagen)
      && !/^\/(uploads|img)\/[\w./ -]+$/.test(product.imagen)
      && !/^\/media\/[a-f0-9-]{36}\.webp$/.test(product.imagen)) {
    throw new HttpError(400, 'La imagen debe ser una URL http(s) o una imagen subida al sitio.');
  }
  for (const key of ['tamanos', 'sabores', 'versiones', 'colores', 'materiales']) {
    if (input[key] != null && !Array.isArray(input[key])) throw new HttpError(400, `${key} debe ser una lista.`);
    product[key] = [...new Set((input[key] || []).map(String).map(value => value.trim()).filter(Boolean))];
    if (product[key].length > 40 || product[key].some(value => value.length > 100)) throw new HttpError(400, `Demasiadas opciones en ${key}.`);
  }
  product.preciosPorTamano = {};
  for (const size of product.tamanos) {
    if (Object.hasOwn(input.preciosPorTamano || {}, size)) {
      Object.defineProperty(product.preciosPorTamano, size, {
        value: number(input.preciosPorTamano[size], `Precio de ${size}`), enumerable: true,
      });
    }
  }
  return product;
}
