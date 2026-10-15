import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { buildOrderMessage, buildWhatsAppUrl, money, paymentMethods, variantText } from "../utils/pedido.js";
import "../../assets/css/pages/pedido.css";
import { useCatalog } from "../context/CatalogContext.jsx";
import { reconcileCart } from "../utils/cart.js";

export default function Facturacion() {
  const cart = useCart();
  const { loading, error, refresh } = useCatalog();
  const [checking, setChecking] = useState(false);
  const [orderNotice, setOrderNotice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingOption, setShippingOption] = useState("retiro");
  const [installments, setInstallments] = useState("");
  const [contact, setContact] = useState({ nombre: "", telefono: "", direccion: "", localidad: "", codigoPostal: "" });
  const [notes, setNotes] = useState("");
  const changeContact = (event) => setContact((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const message = buildOrderMessage({ ...cart, paymentMethod, installments, shippingOption, contact, notes });

  return (
    <main className="pedido-page">
      {(cart.catalogNotice || orderNotice) && <p role="status" className="catalog-status">{orderNotice || cart.catalogNotice}</p>}
      <header className="pedido-header">
        <p className="pedido-eyebrow">TU PEDIDO, A UN MENSAJE</p>
        <h1>Completá tu pedido</h1>
        <p>Elegí cómo pagar y recibir tus productos. La central coordina todo con vos por WhatsApp.</p>
        <nav className="pedido-steps" aria-label="Pasos del pedido">
          <Link to="/carrito">1. Productos</Link><span aria-current="step">2. Pago y entrega</span><span>3. WhatsApp</span>
        </nav>
      </header>
      {!cart.items.length ? (
        <section className="pedido-panel pedido-empty">
          <h2>Tu carrito está vacío</h2>
          <p>Elegí tus productos para armar el pedido.</p>
          <Link className="pedido-button" to="/">Ver productos</Link>
        </section>
      ) : (
        <div className="pedido-layout">
          <form className="pedido-fields" noValidate onSubmit={(event) => event.preventDefault()}>
            <fieldset className="pedido-panel">
              <legend>Medio de pago</legend>
              <p>Elegí tu preferencia. El pago se coordina con la central.</p>
              <div className="pedido-options">
                {paymentMethods.map((method) => <label key={method.id} className={paymentMethod === method.id ? "is-selected" : ""}>
                  <input type="radio" name="pago" value={method.id} checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                  {method.label}
                </label>)}
              </div>
              {paymentMethod === "tarjetaCredito" && <label className="pedido-field">
                Cuotas que te interesan
                <input value={installments} onChange={(event) => setInstallments(event.target.value)} placeholder="Ej.: 3 cuotas o a coordinar" />
                <small>La central te informa las cuotas disponibles y el importe final.</small>
              </label>}
            </fieldset>
            <fieldset className="pedido-panel">
              <legend>Entrega</legend>
              <div className="pedido-options">
                <label className={shippingOption === "retiro" ? "is-selected" : ""}>
                  <input type="radio" name="entrega" checked={shippingOption === "retiro"} onChange={() => setShippingOption("retiro")} />Retiro por Casa Central
                </label>
                <label className={shippingOption === "envio" ? "is-selected" : ""}>
                  <input type="radio" name="entrega" checked={shippingOption === "envio"} onChange={() => setShippingOption("envio")} />Envío a domicilio
                </label>
              </div>
              {shippingOption === "retiro" ? <p>Av. Mitre 564. Coordinamos el retiro por WhatsApp.</p> : <>
                <div className="pedido-contact">
                  <label className="pedido-field pedido-wide">Dirección y departamento
                    <input name="direccion" autoComplete="street-address" value={contact.direccion} onChange={changeContact} placeholder="Calle, número, piso o departamento" />
                  </label>
                  <label className="pedido-field">Localidad / provincia
                    <input name="localidad" autoComplete="address-level2" value={contact.localidad} onChange={changeContact} placeholder="Tu localidad y provincia" />
                  </label>
                  <label className="pedido-field">Código postal
                    <input name="codigoPostal" autoComplete="postal-code" value={contact.codigoPostal} onChange={changeContact} />
                  </label>
                </div>
                <p>El costo y el plazo del envío se coordinan con la central.</p>
              </>}
            </fieldset>
            <fieldset className="pedido-panel">
              <legend>Tus datos</legend>
              <div className="pedido-contact">
                <label className="pedido-field">Nombre y apellido
                  <input name="nombre" autoComplete="name" value={contact.nombre} onChange={changeContact} placeholder="¿Cómo te llamás?" />
                </label>
                <label className="pedido-field">Teléfono de contacto
                  <input name="telefono" type="tel" autoComplete="tel" value={contact.telefono} onChange={changeContact} placeholder="Código de área y número" />
                </label>
                <label className="pedido-field pedido-wide">Observaciones
                  <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Horarios de entrega, referencias o consultas sobre el pedido" />
                </label>
              </div>
              <p>Si dejás algún dato pendiente, podés coordinarlo por WhatsApp.</p>
            </fieldset>
          </form>
          <aside className="pedido-panel pedido-summary" aria-label="Resumen del pedido">
            <h2>Tu pedido</h2>
            <Link to="/carrito">Editar productos</Link>
            <ul className="pedido-items">{cart.items.map((item) => <li key={item.cartKey}>
              <strong>{item.nombre}</strong>
              {variantText(item) && <small>{variantText(item)}</small>}
              <span>{item.qty} × {money(item.precio)} <b>{money(item.qty * item.precio)}</b></span>
            </li>)}</ul>
            <dl className="pedido-totals">
              <div><dt>Subtotal</dt><dd>{money(cart.total)}</dd></div>
              {cart.couponDiscount > 0 && <div><dt>Cupón {cart.couponCode.trim().toUpperCase()}</dt><dd>−{money(cart.couponDiscount)}</dd></div>}
              <div className="pedido-total"><dt>Total de productos</dt><dd>{money(cart.totalWithDiscount)}</dd></div>
              <div><dt>Entrega</dt><dd>{shippingOption === "envio" ? "Envío a coordinar" : "Retiro sin costo"}</dd></div>
            </dl>
            <p>La central confirma disponibilidad, descuentos y condiciones de pago antes de cerrar la compra.</p>
            <button className="pedido-button pedido-whatsapp" disabled={checking || loading || Boolean(error)} onClick={async () => {
              setChecking(true); setOrderNotice('');
              try {
                const current = await refresh();
                if (!current) { setOrderNotice('No pudimos actualizar el catálogo. Reintentá antes de enviar el pedido.'); return; }
                if (JSON.stringify(reconcileCart(cart.items, current)) !== JSON.stringify(cart.items)) {
                  setOrderNotice('El catálogo cambió. Revisá el carrito actualizado y volvé a enviar el pedido.'); return;
                }
                window.location.assign(buildWhatsAppUrl(message));
              } finally { setChecking(false); }
            }}>{checking ? 'Actualizando pedido…' : 'Enviar pedido por WhatsApp'}</button>
            <small>Se abrirá WhatsApp con el pedido armado. Tocá enviar en el chat de Casa Central para compartirlo.</small>
            <details className="pedido-preview"><summary>Ver el mensaje completo</summary><pre>{message}</pre></details>
          </aside>
        </div>
      )}
    </main>
  );
}
