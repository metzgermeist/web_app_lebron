export function cartKey(product) {
  const variants = Object.entries(product.variantDetail || {})
    .filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([String(product.id), variants]);
}

export function normalizeCart(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && item.id != null && Number.isFinite(item.precio)
    && Number.isInteger(item.qty) && item.qty > 0)
    .map((item) => ({ ...item, cartKey: cartKey(item) }));
}

export function stockAvailable(items, product, stock) {
  return Math.max(0, stock - items.reduce((sum, item) =>
    String(item.id) === String(product.id) && item.cartKey !== product.cartKey
      ? sum + item.qty : sum, 0));
}

export function addToCart(items, product, qty, stock) {
  if (!product || product.id == null || !Number.isInteger(qty) || qty <= 0) return items;
  const key = cartKey(product);
  const current = items.find((item) => item.cartKey === key);
  const max = stockAvailable(items, { ...product, cartKey: key }, stock);
  const nextQty = Math.min(max, (current?.qty || 0) + qty);
  if (nextQty <= 0) return items;
  return current
    ? items.map((item) => item.cartKey === key ? { ...item, qty: nextQty } : item)
    : [...items, { id: product.id, nombre: product.nombre, precio: product.precio,
      imagen: product.imagen, variantDetail: product.variantDetail || {},
      cartKey: key, stock, qty: nextQty }];
}

export function reconcileCart(items, products) {
  const next = [];
  const options = { 'tamaño':'tamanos', sabor:'sabores', 'versión':'versiones', color:'colores', material:'materiales' };
  for (const item of items) {
    const product = products.find(product => String(product.id) === String(item.id));
    if (!product || product.disponible === false || product.stock <= 0) continue;
    const variants = item.variantDetail || {};
    if (Object.entries(options).some(([key, field]) =>
      (variants[key] && !product[field]?.includes(variants[key])) || (product[field]?.length && !variants[key]))) continue;
    const used = next.filter(line => String(line.id) === String(item.id)).reduce((sum,line) => sum+line.qty,0);
    const qty = Math.min(item.qty, Math.max(0, product.stock-used));
    if (!qty) continue;
    next.push({ ...item, nombre:product.nombre, imagen:product.imagen, stock:product.stock,
      precio:product.preciosPorTamano?.[variants['tamaño']] ?? product.precio, qty });
  }
  return next;
}
