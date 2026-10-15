export async function api(route, options = {}) {
  const response = await fetch(`/api/${route}`, {
    credentials: 'same-origin', ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor del catálogo no está disponible.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'No se pudo completar la operación.');
    error.status = response.status;
    throw error;
  }
  return data;
}
