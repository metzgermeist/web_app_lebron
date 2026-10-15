import demoImg from "../../assets/img/starr (1).png";
// Nota: el archivo local tiene paréntesis en el nombre
// Si luego lo renombrás a "proteina2.png", avisá y actualizo la importación
import proteina2 from "../../assets/img/proteina2 (1).png";

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../src/context/CartContext.jsx";

export default function TarjetaProducto({ producto = {}, categoria, variant = "category" }) {
  const { nombre, precio, marca, tamanos, sabores, imagen, descripcion } = producto || {};
  const numericPrice =
    typeof precio === "number"
      ? precio
      : Number(precio?.toString().replace(/[^\d.-]/g, ""));
  const formattedPrice = Number.isFinite(numericPrice)
    ? numericPrice.toLocaleString("es-AR")
    : precio;

  const cart = useCart();
  const navigate = useNavigate();
  const productUrl = `/producto/${producto.id}`;
  const hasVariants = [producto.tamanos, producto.sabores, producto.versiones,
    producto.colores, producto.materiales].some((options) => options?.length > 0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  });
  const cardRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsFlipped(false);
  }, [producto?.id]);

  useEffect(() => {
    if (!isMobile || !isFlipped) return undefined;
    const handleOutsideClick = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setIsFlipped(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isFlipped, isMobile]);

  const handleCardClick = (event) => {
    if (!isMobile) return;
    const target = event.target;
    if (!isFlipped) {
      setIsFlipped(true);
      return;
    }

    if (target instanceof Element && target.closest(".tp3d-add")) {
      return;
    }

    navigate(productUrl);
  };

  const handleKeyDown = (event) => {
    if (!isMobile) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick(event);
    }
  };

  const handleAddToCart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hasVariants) navigate(productUrl);
    else cart?.addItem?.(producto, 1);
  };

  const cardContent = (
    <section className="tp3d-card" aria-live="polite">
      <header className="tp3d-front">
        <h3 className="tp3d-title">{nombre}</h3>
        <figure className="tp3d-figure">
          <span className="tp3d-img" aria-hidden="true">
            <img
              src={imagen || proteina2}
              alt={nombre}
              loading="lazy"
              onError={(e) => {
                if (e.currentTarget.src !== demoImg) e.currentTarget.src = demoImg;
              }}
            />
          </span>
          {descripcion && <figcaption className="sr-only">{descripcion}</figcaption>}
        </figure>
        {formattedPrice && (
          <p className="tp3d-price tp3d-price--new">$ {formattedPrice}</p>
        )}
      </header>

      <aside className="tp3d-side" aria-label="Detalles del producto">
        <h4 className="tp3d-side-title">{nombre}</h4>
        <ul className="tp3d-list" role="list">
          {marca && (
            <li>
              <strong>Marca</strong> {marca}
            </li>
          )}
          {Array.isArray(tamanos) && tamanos.length > 0 && (
            <li>
              <strong>Tamaños</strong> {tamanos.join(", ")}
            </li>
          )}
          {Array.isArray(sabores) && sabores.length > 0 && (
            <li>
              <strong>Sabores</strong> {sabores.join(", ")}
            </li>
          )}
        </ul>
        <button
          className="tp3d-add"
          type="button"
          disabled={producto.disponible === false || producto.stock <= 0}
          aria-label={`${hasVariants ? "Elegir opciones de" : "Agregar al carrito:"} ${nombre}`}
          data-add-to-cart={hasVariants ? undefined : nombre}
          onClick={handleAddToCart}
        >
          {producto.disponible === false || producto.stock <= 0 ? "No disponible" : hasVariants ? "Elegir opciones" : "Agregar al carrito"}
        </button>
      </aside>
    </section>
  );

  const wrapClasses = ["tp3d-wrap", variant ? `tp3d-wrap--${variant}` : ""].filter(Boolean).join(" ");

  if (!isMobile) {
    return (
      <article className={wrapClasses} aria-label={`${nombre} ${categoria || "producto"}`}>
        <Link to={productUrl} className="tp3d-link" aria-label={`Ver ${nombre}`} tabIndex={-1}>
          {cardContent}
        </Link>
      </article>
    );
  }

  return (
    <article
      className={`${wrapClasses}${isFlipped ? " is-flipped" : ""}`}
      aria-label={`${nombre} ${categoria || "producto"}`}
      tabIndex={0}
      role="button"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      ref={cardRef}
    >
      {cardContent}
    </article>
  );
}
