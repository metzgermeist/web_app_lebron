import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api.js';

const CatalogContext = createContext(null);
export function CatalogProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestNumber = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++requestNumber.current;
    try {
      const next = await api('catalogo/productos');
      if (current !== requestNumber.current) return;
      setProducts(next); setError('');
      return next;
    } catch (failure) {
      if (current === requestNumber.current) { setProducts([]); setError(failure.message); }
    } finally { if (current === requestNumber.current) setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    const onFocus = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = setInterval(onFocus, 60_000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(timer); };
  }, [refresh]);
  return <CatalogContext.Provider value={{ products, loading, error, refresh }}>{children}</CatalogContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const useCatalog = () => useContext(CatalogContext);

export function CatalogStatus() {
  const { loading, error, refresh } = useCatalog();
  if (!loading && !error) return null;
  return <div className="catalog-status" role={error ? 'alert' : 'status'}>
    {loading ? 'Cargando catálogo…' : <>{error} <button onClick={refresh}>Reintentar</button></>}
  </div>;
}
