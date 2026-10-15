export const CENTRAL_WHATSAPP = "543816337883";

export const paymentMethods = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia bancaria" },
  { id: "tarjetaDebito", label: "Tarjeta de débito" },
  { id: "tarjetaCredito", label: "Tarjeta de crédito" },
];

export const money = (value) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 2,
}).format(value);

export const variantText = (item) => Object.entries(item.variantDetail || {})
  .filter(([, value]) => value)
  .map(([key, value]) => `${key}: ${value}`).join(" · ");

export function buildOrderMessage({ items, total, couponCode, couponDiscount,
  totalWithDiscount, paymentMethod, installments, shippingOption, contact, notes }) {
  const filled = (value) => value?.trim() || "A coordinar";
  return [
    "¡Hola, Casa Central de LeBron! Quiero hacer este pedido:",
    "", "*PRODUCTOS*",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.nombre} (cód. ${item.id})`,
      ...(variantText(item) ? [`   ${variantText(item)}`] : []),
      `   ${item.qty} × ${money(item.precio)} = ${money(item.qty * item.precio)}`,
    ]),
    "", "*RESUMEN*", `Subtotal: ${money(total)}`,
    ...(couponCode?.trim() ? [`Cupón: ${couponCode.trim().toUpperCase()}`] : []),
    ...(couponDiscount > 0 ? [`Descuento del cupón: -${money(couponDiscount)}`] : []),
    `Total de productos: ${money(totalWithDiscount)}`,
    "", "*PAGO*",
    `Medio elegido: ${paymentMethods.find((method) => method.id === paymentMethod)?.label || "A coordinar"}`,
    ...(paymentMethod === "tarjetaCredito" ? [`Cuotas solicitadas: ${filled(installments)}`] : []),
    "", "*ENTREGA Y CONTACTO*",
    `Modalidad: ${shippingOption === "envio" ? "Envío a domicilio" : "Retiro por Casa Central — Av. Mitre 564"}`,
    `Nombre: ${filled(contact.nombre)}`, `Teléfono: ${filled(contact.telefono)}`,
    ...(shippingOption === "envio" ? [
      `Dirección: ${filled(contact.direccion)}`, `Localidad: ${filled(contact.localidad)}`,
      `Código postal: ${filled(contact.codigoPostal)}`,
    ] : []),
    `Observaciones: ${notes?.trim() || "Sin observaciones"}`,
    "", "Pedido pendiente de confirmación por la central. Stock, envío, descuentos y condiciones de pago a confirmar por WhatsApp.",
  ].join("\n");
}

export const buildWhatsAppUrl = (message) =>
  `https://wa.me/${CENTRAL_WHATSAPP}?text=${encodeURIComponent(message)}`;
