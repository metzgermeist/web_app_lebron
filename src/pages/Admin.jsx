import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api.js';
import { money } from '../utils/pedido.js';
import { exportCsv, parseCsv } from '../utils/catalogCsv.js';
import { useCatalog } from '../context/CatalogContext.jsx';
import AdminAccess, { AdminPassword } from './AdminAccess.jsx';
import '../../assets/css/pages/admin.css';

const emptyProduct = () => ({ nombre:'', descripcion:'', categoria:'', marca:'', precio:0, stock:0,
  imagen:'', visible:false, disponible:true, destacado:false, tamanos:[], sabores:[], versiones:[], colores:[], materiales:[], preciosPorTamano:{} });
const optionFields = { tamanos:'Tamaños', sabores:'Sabores', versiones:'Versiones', colores:'Colores', materiales:'Materiales' };

export default function Admin() {
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [pendingImport, setPendingImport] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishedId, setPublishedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useCatalog();
  const loadSession = () => api('admin/session').then(setSession).catch(failure => setError(failure.message));
  useEffect(() => { loadSession(); }, []);
  useEffect(() => {
    if (session?.username) api('admin/products').then(setProducts).catch(failure => setError(failure.message));
  }, [session?.username]);

  async function run(action) {
    setBusy(true); setError(''); setNotice(''); setPublishedId(null);
    try { await action(); }
    catch (failure) { setError(failure.message); if (failure.status === 401) setSession({ username: null }); }
    finally { setBusy(false); }
  }
  async function saved(product) {
    const result = await api(product.id ? `admin/products/${product.id}` : 'admin/products', {
      method: product.id ? 'PUT' : 'POST', body: JSON.stringify(product),
    });
    setProducts(await api('admin/products')); await refresh();
    return result;
  }
  function download() {
    const url = URL.createObjectURL(new Blob([exportCsv(products)], { type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'catalogo-lebron.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shown = products.filter(product => `${product.nombre} ${product.marca} ${product.categoria}`.toLowerCase().includes(query.toLowerCase())
    && (filter === 'todos' || (filter === 'visibles' ? product.visible : !product.visible)));

  return <main className="admin-page">
    <header className="admin-heading"><div><p>LEBRON · ADMINISTRACIÓN</p><h1>Gestión del catálogo</h1></div><Link to="/">Ver sitio</Link></header>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice} {publishedId && <Link to={`/producto/${publishedId}`}>Ver producto publicado</Link>}</p>}
    {!session ? <section className="admin-card"><p>Conectando con el servidor…</p>{error && <button onClick={loadSession}>Reintentar</button>}</section>
      : !session.username ? <AdminAccess session={session} busy={busy} run={run} onAuthenticated={loadSession} /> : <>
        <div className="admin-session"><span>Sesión de {session.username}</span><button disabled={busy} onClick={() => run(async () => {
          await api('admin/logout', { method:'POST', body:'{}' }); setEditing(null); setProducts([]); await loadSession();
        })}>Cerrar sesión</button></div>
        <AdminPassword busy={busy} run={run} onChanged={async () => {
          setEditing(null); setProducts([]); await loadSession(); setNotice('Contrase\u00f1a actualizada. Ingres\u00e1 nuevamente.');
        }} />
        <section className="admin-stats"><div><strong>{products.length}</strong> Productos</div><div><strong>{products.filter(product => product.visible).length}</strong> Visibles</div><div><strong>{products.filter(product => !product.disponible || product.stock === 0).length}</strong> No disponibles</div></section>
        <section className="admin-card">
          <div className="admin-toolbar">
            <label>Buscar<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre, categoría o marca" /></label>
            <label>Mostrar<select value={filter} onChange={event => setFilter(event.target.value)}><option value="todos">Todos</option><option value="visibles">Visibles</option><option value="ocultos">Ocultos</option></select></label>
            <button disabled={busy} onClick={() => setEditing(emptyProduct())}>Nuevo producto</button>
            <button disabled={busy || !products.length} onClick={download}>Exportar CSV</button>
            <label className="admin-file">Importar CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => {
              const file = event.target.files[0]; event.target.value = '';
              if (file) run(async () => {
                if (file.size > 5 * 1024 * 1024) throw new Error('El CSV no puede superar 5 MB.');
                const result = await api('admin/import', { method:'POST', body:JSON.stringify({ products:parseCsv(await file.text()), preview:true }) });
                setPendingImport(result.products);
              });
            }} /></label>
          </div>
          <p>Ocultar un producto lo retira de la tienda sin borrarlo. Descargá el CSV para usarlo como plantilla de importación.</p>
          {pendingImport && <section className="admin-import"><h2>Revisar importación</h2>
            <p>{pendingImport.length} productos: {pendingImport.filter(product => products.some(current => current.id === product.id)).length} actualizaciones y {pendingImport.filter(product => !products.some(current => current.id === product.id)).length} nuevos.</p>
            <ul>{pendingImport.map(product => <li key={product.id}>{product.nombre} · {money(product.precio)} · {product.visible ? 'Visible' : 'Oculto'}</li>)}</ul>
            <button disabled={busy} onClick={() => run(async () => {
              await api('admin/import', { method:'POST', body:JSON.stringify({ products:pendingImport }) });
              setProducts(await api('admin/products')); setPendingImport(null); await refresh(); setNotice('Importación completada.');
            })}>Confirmar importación</button> <button disabled={busy} onClick={() => setPendingImport(null)}>Cancelar</button>
          </section>}
          <div className="admin-table-wrap"><table><thead><tr><th>Producto</th><th>Precio / stock</th><th>Publicación</th><th>Acciones</th></tr></thead><tbody>
            {shown.map(product => <tr key={product.id}><td><strong>{product.nombre}</strong><small>{product.categoria} · {product.marca || 'Sin marca'}{product.destacado ? ' · Destacado' : ''}</small></td>
              <td>{money(product.precio)}<small>{product.disponible ? `${product.stock} unidades` : 'No disponible'}</small></td>
              <td><span className={product.visible ? 'admin-visible' : 'admin-hidden'}>{product.visible ? 'Visible' : 'Oculto'}</span></td>
              <td><div className="admin-actions"><button disabled={busy} onClick={() => { setEditing(structuredClone(product)); setError(''); }}>Editar</button><button disabled={busy} onClick={() => run(async () => {
                await saved({ ...product, visible: !product.visible }); setNotice(product.visible ? 'Producto ocultado.' : 'Producto publicado en su categoría y en la búsqueda.');
                if (!product.visible) setPublishedId(product.id);
                // Evitar que un editor abierto vuelva a guardar el estado anterior.
                if (editing?.id === product.id) setEditing(null);
              })}>{product.visible ? 'Ocultar' : 'Publicar'}</button>
              {product.visible && <Link to={`/producto/${product.id}`}>Ver producto</Link>}</div></td></tr>)}
          </tbody></table></div>
          {!shown.length && <p>No hay productos para esta búsqueda.</p>}
        </section>
        {editing && <ProductEditor key={editing.id || 'new'} initial={editing} busy={busy}
          categories={[...new Set(products.map(product => product.categoria))]} brands={[...new Set(products.map(product => product.marca).filter(Boolean))]}
          onCancel={() => setEditing(null)} onSave={product => run(async () => {
            const result = await saved(product); setEditing(null);
            setNotice(result.visible ? 'Producto guardado y publicado en su categoría y en la búsqueda.' : 'Producto guardado como oculto. Presioná Publicar para mostrarlo en la tienda.');
            if (result.visible) setPublishedId(result.id);
          })} />}
      </>}
  </main>;
}

function ProductEditor({ initial, busy, onSave, onCancel, categories, brands }) {
  const [product, setProduct] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [optionText, setOptionText] = useState(Object.fromEntries(Object.keys(optionFields).map(key => [key, (initial[key] || []).join(', ')])));
  const change = (key, value) => setProduct(previous => ({ ...previous, [key]:value }));
  return <section className="admin-card admin-editor" aria-label="Editor de producto">
    <form onSubmit={event => { event.preventDefault(); onSave(product); }}>
      <h2>{product.id ? `Editar: ${initial.nombre}` : 'Nuevo producto'}</h2>
      <div className="admin-form-grid">
        <label className="admin-wide">Nombre<input autoFocus value={product.nombre} onChange={event => change('nombre',event.target.value)} required maxLength={160} /></label>
        <label>Categoría<input list="admin-categories" value={product.categoria} onChange={event => change('categoria',event.target.value)} required maxLength={80} /></label>
        <datalist id="admin-categories">{categories.map(value => <option key={value} value={value} />)}</datalist>
        <label>Marca<input list="admin-brands" value={product.marca} onChange={event => change('marca',event.target.value)} maxLength={100} /></label>
        <datalist id="admin-brands">{brands.map(value => <option key={value} value={value} />)}</datalist>
        <label>Precio base (ARS)<input type="number" min="0" step="0.01" required value={product.precio} onChange={event => change('precio',event.target.value)} /></label>
        <label>Stock del producto<input type="number" min="0" step="1" required value={product.stock} onChange={event => change('stock',event.target.value)} /></label>
        <label className="admin-wide">Descripción<textarea rows={4} maxLength={5000} value={product.descripcion} onChange={event => change('descripcion',event.target.value)} /></label>
        <label className="admin-wide">URL de imagen<input value={product.imagen} onChange={event => change('imagen',event.target.value)} placeholder="https://… o subí una imagen" /></label>
        <label>Subir imagen (hasta 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={async event => {
          const file = event.target.files[0]; if (!file) return;
          setUploading(true); setUploadError('');
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera 5 MB.');
            const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            const result = await api('admin/uploads', { method:'POST', body:JSON.stringify({ data }) }); change('imagen',result.url);
          } catch (failure) { setUploadError(failure.message || 'No se pudo subir la imagen.'); }
          finally { setUploading(false); }
        }} /></label>
        {product.imagen && <img className="admin-image" src={product.imagen} alt="Vista previa del producto" />}
      </div>
      {uploadError && <p role="alert" className="admin-error">{uploadError}</p>}
      <fieldset><legend>Opciones del producto</legend><p>Separá las opciones con comas. El stock es compartido entre todas las opciones.</p><div className="admin-form-grid">
        {Object.entries(optionFields).map(([key,label]) => <label key={key}>{label}<input value={optionText[key]} onChange={event => {
          const value = event.target.value; setOptionText(previous => ({ ...previous, [key]:value }));
          change(key, [...new Set(value.split(',').map(option => option.trim()).filter(Boolean))]);
        }} /></label>)}
      </div>
      {product.tamanos.length > 0 && <><p>Precio por tamaño. Dejalo vacío para usar el precio base.</p><div className="admin-form-grid">{product.tamanos.map(size => <label key={size}>{size}<input type="number" min="0" step="0.01" value={product.preciosPorTamano[size] ?? ''} onChange={event => {
        const prices = { ...product.preciosPorTamano };
        if (event.target.value === '') delete prices[size]; else prices[size] = Number(event.target.value);
        change('preciosPorTamano',prices);
      }} /></label>)}</div></>}
      </fieldset>
      <div className="admin-checks">{[['visible','Mostrar en el sitio'],['disponible','Disponible para pedidos'],['destacado','Producto destacado']].map(([key,label]) => <label key={key}><input type="checkbox" checked={product[key]} onChange={event => change(key,event.target.checked)} />{label}</label>)}</div>
      <p>Estas opciones se aplican al guardar. Un producto publicado aparece en su categoría y en la búsqueda; para mostrarlo también entre los destacados del inicio, marcá «Producto destacado».</p>
      <footer className="admin-actions"><button disabled={busy || uploading}>{busy ? 'Guardando…' : product.visible ? 'Guardar y publicar' : 'Guardar como oculto'}</button><button type="button" disabled={busy || uploading} onClick={onCancel}>Cancelar</button></footer>
    </form>
  </section>;
}
