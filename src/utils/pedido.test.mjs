import test from "node:test";
import assert from "node:assert/strict";
import { addToCart, cartKey, normalizeCart, stockAvailable } from "./cart.js";
import { buildOrderMessage, buildWhatsAppUrl, CENTRAL_WHATSAPP, money, paymentMethods } from "./pedido.js";

const product = { id: 1, nombre: "Proteína & recuperación", precio: 31500, imagen: "/img/proteina.jpg",
  variantDetail: { tamaño: "1kg", sabor: "Cookies & Cream" } };
const order = {
  items: [{ ...product, qty: 2 }], total: 63000, couponCode: "lebron10",
  couponDiscount: 6300, totalWithDiscount: 56700, paymentMethod: "transferencia",
  shippingOption: "envio", contact: { nombre: "María Pérez", telefono: "+54 381 1234567",
    direccion: "Mitre 123, 2° A", localidad: "Tucumán", codigoPostal: "4000" },
  notes: "Llamar al llegar & consultar horario #2",
};

test("WhatsApp recibe exactamente el pedido completo, con tildes y caracteres especiales", () => {
  const message = buildOrderMessage(order);
  const url = new URL(buildWhatsAppUrl(message));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, `/${CENTRAL_WHATSAPP}`);
  assert.equal(url.searchParams.get("text"), message);
  assert.equal([...url.searchParams].length, 1);
  for (const value of [product.nombre, "tamaño: 1kg", "sabor: Cookies & Cream",
    `2 × ${money(31500)} = ${money(63000)}`, "LEBRON10", money(6300), money(56700),
    "Transferencia bancaria", ...Object.values(order.contact), order.notes]) {
    assert.ok(message.includes(value), `Falta en el mensaje: ${value}`);
  }
});

test("Se puede coordinar el pedido sin completar datos ni validar un pago", () => {
  const message = buildOrderMessage({ ...order, contact: {}, paymentMethod: "",
    shippingOption: "retiro", couponCode: "", couponDiscount: 0, notes: "" });
  assert.ok(message.includes("Nombre: A coordinar"));
  assert.ok(message.includes("Medio elegido: A coordinar"));
  assert.ok(message.includes("Retiro por Casa Central — Av. Mitre 564"));
  assert.ok(!message.includes("Dirección:"));
  assert.ok(!message.includes("Cupón:"));
  assert.ok(message.includes("pendiente de confirmación"));
});

test("Todos los medios de pago se describen, con cuotas sólo para crédito", () => {
  for (const method of paymentMethods) {
    const message = buildOrderMessage({ ...order, paymentMethod: method.id, installments: "3" });
    assert.ok(message.includes(method.label));
    assert.equal(message.includes("Cuotas solicitadas: 3"), method.id === "tarjetaCredito");
  }
});

test("Variantes distintas mantienen sus precios y cantidades separados", () => {
  const larger = { ...product, precio: 56200, variantDetail: { tamaño: "2kg", sabor: "Vainilla" } };
  let items = addToCart([], product, 1, 20);
  items = addToCart(items, larger, 1, 20);
  items = addToCart(items, product, 2, 20);
  assert.equal(items.length, 2);
  assert.equal(items[0].qty, 3);
  assert.equal(items[1].qty, 1);
  assert.equal(items[1].precio, 56200);
  assert.equal(items.reduce((total, item) => total + item.precio * item.qty, 0), 150700);
  assert.deepEqual(normalizeCart(JSON.parse(JSON.stringify(items))), items);
  assert.equal(cartKey(product), cartKey({ ...product, variantDetail: { sabor: "Cookies & Cream", tamaño: "1kg" } }));
});

test("El stock total se comparte entre variantes y no agrega cantidades cero", () => {
  let items = addToCart([], product, 2, 3);
  const other = { ...product, variantDetail: { sabor: "Vainilla" } };
  items = addToCart(items, other, 4, 3);
  assert.equal(items[1].qty, 1);
  assert.equal(stockAvailable(items, items[0], 3), 2);
  assert.deepEqual(addToCart(items, product, 1, 3), items);
  assert.deepEqual(addToCart([], product, 1, 0), []);
});

test("El carrito existente se recupera y los datos inválidos se descartan", () => {
  const legacy = { id: 1, nombre: "Proteína", precio: 45000, qty: 2 };
  assert.equal(normalizeCart([legacy])[0].cartKey, cartKey(legacy));
  assert.deepEqual(normalizeCart({ items: [] }), []);
  assert.deepEqual(normalizeCart([null, { ...legacy, qty: 0 }]), []);
});
