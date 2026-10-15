import { useMemo, useState, useEffect } from "react";
import { useCatalog } from "../../src/context/CatalogContext.jsx";
import TarjetaProducto from "./tarjetaproductos.jsx";
import "../../assets/css/atomicos/productosDestacados.css";

const DESKTOP_CARDS = 4;
const MOBILE_CARDS = 1;

export default function ProductosDestacados() {
  const { products } = useCatalog();
  const destacadoItems = useMemo(
    () => (products || []).filter((p) => Boolean(p.destacado)),
    [products],
  );
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    if (typeof window === "undefined") return DESKTOP_CARDS;
    return window.innerWidth <= 768 ? MOBILE_CARDS : DESKTOP_CARDS;
  });

  useEffect(() => {
    const handler = () => {
      const target = window.innerWidth <= 768 ? MOBILE_CARDS : DESKTOP_CARDS;
      setItemsPerPage(target);
    };
    window.addEventListener("resize", handler);
    handler();
    return () => window.removeEventListener("resize", handler);
  }, []);

  const pages = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < destacadoItems.length; i += itemsPerPage) {
      chunks.push(destacadoItems.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [destacadoItems, itemsPerPage]);
  const pageCount = Math.max(1, pages.length);
  const [rawPage, setPage] = useState(0);
  const page = Math.min(rawPage, pageCount - 1);

  if (destacadoItems.length === 0) return null;

  const handleNext = () => setPage((prev) => (prev + 1) % pageCount);
  const handlePrev = () => setPage((prev) => (prev - 1 + pageCount) % pageCount);

  return (
    <section className="productos-destacados section">
      <div className="productos-destacados__header">
        <div>
          <p className="productos-destacados__eyebrow">Selección Lebron</p>
          <h2>Productos destacados</h2>
        </div>
      </div>

      <div className="productos-destacados__slider">
        <div className="productos-destacados__viewport" aria-live="polite">
          <div
            className="productos-destacados__track"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {pages.map((chunk, pageIndex) => (
              <div className="productos-destacados__page" key={`page-${pageIndex}`}>
                {chunk.map((producto) => (
                  <article key={producto.id} className="productos-destacados__item" role="listitem">
                    <TarjetaProducto
                      producto={producto}
                      categoria={producto.categoria}
                      variant="featured"
                    />
                  </article>
                ))}
            </div>
            ))}
          </div>
        </div>
        <footer className="productos-destacados__footer">
          <button
            type="button"
            className="productos-destacados__control productos-destacados__control--prev"
            onClick={handlePrev}
            aria-label="Producto anterior"
          >
            ‹
          </button>
          <p className="productos-destacados__meta">
            {destacadoItems.length} destacados disponibles – Página {page + 1} de {pageCount}
          </p>
          <button
            type="button"
            className="productos-destacados__control productos-destacados__control--next"
            onClick={handleNext}
            aria-label="Producto siguiente"
          >
            ›
          </button>
        </footer>
      </div>
    </section>
  );
}
