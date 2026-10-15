import { useMemo } from "react";
import { useCart } from "../context/CartContext.jsx";
// Import absoluto desde la raíz del proyecto para evitar problemas de HMR/base
import "../../assets/css/pages/carrito.css";
import Boton from "../../componentes/atomicos/boton.jsx";
import demoImg from "../../assets/img/starr (1).png";
import proteina2 from "../../assets/img/proteina2 (1).png";
import { useCatalog } from "../context/CatalogContext.jsx";
import { stockAvailable } from "../utils/cart.js";
import { variantText } from "../utils/pedido.js";

function Carrito() {
  const { products: productos } = useCatalog();
  const {
    items,
    updateQty,
    removeItem,
    clear,
    couponCode,
    couponDiscount,
    totalWithDiscount,
    applyCoupon,
    catalogNotice,
  } = useCart();
  const stockMap = useMemo(() => {
    const map = new Map();
    productos.forEach((p) => map.set(String(p.id), p.stock ?? 0));
    return map;
  }, [productos]);

  return (
    <main className="section cart-page">
      {catalogNotice && <p role="status" className="catalog-status">{catalogNotice}</p>}
      <section className="container carrito-grid">
        <section className="cart-left" aria-label="Productos en el carrito">
          <header className="cart-left-head">
            <h2>Tu carrito</h2>
            </header>

          {!items.length && (
            <p className="cart-empty">Tu carrito está vacío.</p>
          )}

          <ul className="cart-list" role="list">
            {items.map((it) => {
              const line = (it.precio || 0) * (it.qty || 1);
              const price = (it.precio || 0).toLocaleString("es-AR");
              const linePrice = line.toLocaleString("es-AR");
              const imgSrc = it.imagen || proteina2;
              const maxStock = stockAvailable(items, it, stockMap.get(String(it.id)) ?? 0);
              const canDec = (it.qty || 1) > 1;
              const canInc = (it.qty || 1) < maxStock;
              return (
                <li key={it.cartKey} className="cart-item">
                  <article className="ci-main">
                    <figure className="ci-figure">
                      <img
                        src={imgSrc}
                        alt={it.nombre}
                        loading="lazy"
                        onError={(e) => {
                          if (e.currentTarget.src !== demoImg) e.currentTarget.src = demoImg;
                        }}
                      />
                    </figure>
                    <section className="ci-info">
                      <h3 className="ci-title">{it.nombre}</h3>
                      {variantText(it) && <p className="ci-variants">{variantText(it)}</p>}
                      <p className="ci-price">$ {price}</p>
                      <div className="ci-qty-row">
                        <fieldset className="ci-qty">
                          <legend style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)",whiteSpace:"nowrap"}}>Cantidad</legend>
                          <Boton
                            variant="ghost"
                            effect={false}
                            className="ci-btn"
                          ariaLabel={`Restar 1 a ${it.nombre}`}
                          disabled={!canDec}
                          onClick={() => canDec && updateQty(it.cartKey, (it.qty || 1) - 1)}
                          >
                            -
                          </Boton>
                          <span className="ci-count" aria-live="polite">{it.qty || 1}</span>
                          <Boton
                            variant="ghost"
                            effect={false}
                            className="ci-btn"
                          ariaLabel={`Sumar 1 a ${it.nombre}`}
                          disabled={!canInc}
                          onClick={() => canInc && updateQty(it.cartKey, (it.qty || 1) + 1)}
                          >
                            +
                          </Boton>
                        </fieldset>
                        <span className="ci-total">$ {linePrice}</span>
                      </div>
                      {!canInc && (
                        <small className="ci-stock-msg" aria-live="polite">Stock máximo: {maxStock}</small>
                      )}
                      <Boton
                        variant="ghost"
                        className="ci-remove"
                        altText="Eliminar"
                        onClick={() => removeItem(it.cartKey)}
                        ariaLabel={`Eliminar ${it.nombre} del carrito`}
                      >
                        Eliminar artículo
                      </Boton>
                    </section>
                  </article>
                </li>
              );
            })}
          </ul>

          {items.length > 0 && (
            <Boton
              variant="primary"
              altText="vamos de nuevo"
              className="cart-clear-btn"
              onClick={clear}
            >
              Vaciar carrito
            </Boton>
          )}
        </section>

        <aside className="cart-right" aria-label="Resumen de compra">
          <h2 className="cr-title">Total del carrito</h2>
          <form className="cr-cupon" onSubmit={(e)=>e.preventDefault()}>
            <label htmlFor="cupon">Agregá un cupón</label>
            <section className="cr-cupon-row">
              <input
                id="cupon"
                type="text"
                placeholder="Ej: LEBRON10"
                value={couponCode}
                onChange={(e) => applyCoupon(e.target.value)}
              />
            </section>
          </form>
          <dl>
            <div className="cr-row">
              <dt>Total de productos</dt>
              <dd><strong>$ {totalWithDiscount.toLocaleString("es-AR")}</strong></dd>
            </div>
            {couponDiscount > 0 && (
              <div className="cr-row cr-discount" aria-live="polite">
                <dt>Descuento</dt>
                <dd>- $ {couponDiscount.toLocaleString("es-AR")}</dd>
              </div>
            )}
          </dl>
          <footer className="cr-actions">
          <Boton
            className="cr-pay"
            variant="primary"
            effect={false}
            href={items.length ? "/facturacion" : undefined}
            ariaLabel="Elegir pago y entrega"
            disabled={!items.length}
            aria-disabled={!items.length}
          >
            Elegir pago y entrega
          </Boton>
          <p>El pedido se coordina con Casa Central por WhatsApp.</p>
          </footer>
        </aside>
      </section>
    </main>
  );
}

export default Carrito;
