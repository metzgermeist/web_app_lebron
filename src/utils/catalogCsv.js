const fields = ['id','nombre','categoria','marca','precio','stock','visible','disponible','destacado',
  'descripcion','imagen','tamanos','sabores','versiones','colores','materiales','preciosPorTamano'];
const lists = ['tamanos','sabores','versiones','colores','materiales'];

export function exportCsv(products) {
  const cell = value => {
    let text = String(value ?? '');
    // Evitar fórmulas al abrir el archivo en una planilla.
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [fields, ...products.map(product => fields.map(field =>
    lists.includes(field) ? (product[field] || []).join('|')
      : field === 'preciosPorTamano' ? JSON.stringify(product[field] || {}) : product[field]
  ))].map(row => row.map(cell).join(';')).join('\r\n');
}

export function parseCsv(source) {
  source = source.replace(/^\uFEFF/,'');
  const firstLine = source.split(/\r?\n/)[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  const rows = []; let row = [], value = '', quoted = false;
  for (let i=0; i<source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i+1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === separator || char === '\n')) {
      row.push(value.replace(/\r$/,'')); value = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else value += char;
  }
  if (quoted) throw new Error('Hay comillas sin cerrar en el CSV.');
  if (value || row.length) { row.push(value.replace(/\r$/,'')); rows.push(row); }
  const headers = rows.shift()?.map(header => header.trim());
  if (!headers || !['nombre','categoria','precio','stock'].every(field => headers.includes(field))) throw new Error('El CSV necesita nombre, categoria, precio y stock. Descargá el catálogo para usarlo como plantilla.');
  return rows.filter(row => row.some(Boolean)).map((row, index) => {
    if (row.length !== headers.length) throw new Error(`Revisá las columnas de la fila ${index+2}.`);
    const product = Object.fromEntries(headers.map((header, i) => [header, row[i].replace(/^'(?=[=+@-])/,'')]));
    for (const field of ['precio','stock']) {
      if (product[field].trim() === '') throw new Error(`Falta ${field} en la fila ${index+2}.`);
      product[field] = Number(product[field].replace(',','.'));
    }
    for (const field of ['visible','disponible','destacado']) {
      const raw = product[field]?.trim().toLowerCase();
      if (raw && !['true','false','1','0','si','sí','no'].includes(raw)) throw new Error(`Valor inválido para ${field} en la fila ${index+2}.`);
      product[field] = raw ? ['true','1','si','sí'].includes(raw) : field === 'disponible';
    }
    for (const field of lists) product[field] = (product[field] || '').split('|').map(value => value.trim()).filter(Boolean);
    try { product.preciosPorTamano = JSON.parse(product.preciosPorTamano || '{}'); }
    catch { throw new Error(`Precios por tamaño inválidos en la fila ${index+2}.`); }
    return product;
  });
}
