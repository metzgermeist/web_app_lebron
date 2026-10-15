import { createContext, useContext, useEffect, useState } from "react";
import { useCatalog } from "./CatalogContext.jsx";
import { addToCart, normalizeCart, stockAvailable, reconcileCart } from "../utils/cart.js";

const CartContext = createContext(null);
export function CartProvider({ children }) {
  const { products, loading, error } = useCatalog();
  const [catalogNotice, setCatalogNotice] = useState('');
  const getStock = (id) => {
    const product = products.find(product => String(product.id) === String(id));
    return !loading && !error && product?.disponible !== false ? Math.max(0, product?.stock ?? 0) : 0;
  };
  const [items, setItems] = useState(() => {
    try { return normalizeCart(JSON.parse(localStorage.getItem("cart") || "[]")); }
    catch { return []; }
  });
  const [couponCode, setCouponCode] = useState(() => {
    try { return localStorage.getItem("cart-coupon") || ""; }
    catch { return ""; }
  });

  useEffect(() => {
    if (loading || error) return;
    const current = reconcileCart(items, products);
    if (JSON.stringify(current) !== JSON.stringify(items)) {
      setItems(current);
      setCatalogNotice('Actualizamos tu carrito según el catálogo: revisá los precios, las cantidades y los productos disponibles antes de continuar.');
    }
  }, [products, loading, error, items]);

  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(items));
      localStorage.setItem("cart-coupon", couponCode);
    } catch { /* El carrito sigue funcionando si el navegador no permite guardarlo. */ }
  }, [items, couponCode]);

  const addItem = (product, qty = 1) => {
    if (!product) return;
    setItems((previous) => addToCart(previous, product, qty, getStock(product.id)));
  };
  const updateQty = (key, qty) => {
    if (!Number.isInteger(qty)) return;
    setItems((previous) => previous.map((item) => item.cartKey === key
      ? { ...item, qty: Math.max(0, Math.min(qty,
        stockAvailable(previous, item, getStock(item.id)))) } : item)
      .filter((item) => item.qty > 0));
  };
  const removeItem = (key) => setItems((previous) => previous.filter((item) => item.cartKey !== key));
  const clear = () => { setItems([]); setCouponCode(""); };
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.precio * item.qty, 0);
  const couponDiscount = couponCode.trim().toUpperCase() === "LEBRON10" ? total * 0.1 : 0;
  const totalWithDiscount = Math.max(0, total - couponDiscount);

  return <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clear,
    count, total, couponCode, couponDiscount, totalWithDiscount, applyCoupon: setCouponCode, catalogNotice }}>
    {children}
  </CartContext.Provider>;
}

// El contexto y su hook comparten módulo para conservar la API de los componentes.
// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
