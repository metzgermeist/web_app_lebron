import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import ProductosDestacados from "../../componentes/atomicos/productosDestacados.jsx";
import "../../assets/css/pages/detalle.css";
import Boton from "../../componentes/atomicos/boton.jsx";
import { useCart } from "../context/CartContext.jsx";

export default function Detalle() {
  const { products, loading, error } = useCatalog();
  const { id } = useParams();
  const producto = useMemo(() => {
    return (products || []).find((item) => String(item.id) === String(id));
  }, [id, products]);

  if (loading || error) return <main className="detalle-page"><p>{loading ? 'Cargando producto…' : 'No se pudo consultar el producto.'}</p></main>;
  return producto ? <DetalleProducto key={producto.id} producto={producto} /> : (
    <main className="detalle-page"><p className="detalle-empty">No encontramos ese producto.</p></main>
  );
}

function DetalleProducto({ producto }) {

  const {
    nombre,
    descripcion,
    precio,
    marca,
    imagen,
    preciosPorTamano = {},
    stock,
  } = producto;

  const tamanos = useMemo(() => (Array.isArray(producto.tamanos) ? producto.tamanos : []), [producto.tamanos]);
  const sabores = useMemo(() => (Array.isArray(producto.sabores) ? producto.sabores : []), [producto.sabores]);
  const versionOptions = useMemo(() => (Array.isArray(producto.versiones) ? producto.versiones : []), [producto.versiones]);
  const colorOptions = useMemo(() => (Array.isArray(producto.colores) ? producto.colores : []), [producto.colores]);
  const materialOptions = useMemo(() => (Array.isArray(producto.materiales) ? producto.materiales : []), [producto.materiales]);

  const [selectedSize, setSelectedSize] = useState(tamanos[0] || "");
  const [selectedFlavor, setSelectedFlavor] = useState(sabores[0] || "");
  const [selectedVersion, setSelectedVersion] = useState(versionOptions[0] || "");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0] || "");
  const [selectedMaterial, setSelectedMaterial] = useState(materialOptions[0] || "");
  const navigate = useNavigate();
  const { addItem } = useCart();

  useEffect(() => {
    setSelectedSize(current => tamanos.includes(current) ? current : tamanos[0] || "");
    setSelectedFlavor(current => sabores.includes(current) ? current : sabores[0] || "");
    setSelectedVersion(current => versionOptions.includes(current) ? current : versionOptions[0] || "");
    setSelectedColor(current => colorOptions.includes(current) ? current : colorOptions[0] || "");
    setSelectedMaterial(current => materialOptions.includes(current) ? current : materialOptions[0] || "");
  }, [tamanos, sabores, versionOptions, colorOptions, materialOptions]);

  const precioSeleccionado = preciosPorTamano[selectedSize] ?? precio;
  const formattedPrice =
    typeof precioSeleccionado === "number"
      ? precioSeleccionado.toLocaleString("es-AR")
      : precioSeleccionado;

  const buildCartItem = () => {
    const variantDetail = {
      ...(selectedSize ? { tamaño: selectedSize } : {}),
      ...(selectedFlavor ? { sabor: selectedFlavor } : {}),
      ...(selectedVersion ? { versión: selectedVersion } : {}),
      ...(selectedColor ? { color: selectedColor } : {}),
      ...(selectedMaterial ? { material: selectedMaterial } : {}),
    };

    return {
      ...producto,
      precio: precioSeleccionado,
      variantDetail,
    };
  };

  const handleAddToCart = () => {
    addItem(buildCartItem(), 1);
  };

  const handleComprar = () => {
    handleAddToCart();
    navigate("/facturacion");
  };

  return (
    <main className="detalle-page">
      <header className="detalle-header">
        <Link className="detalle-back" to="/categoria/combos">
          Volver a combos
        </Link>
        <h1>{nombre}</h1>
        <p className="detalle-subtitle">{descripcion}</p>
      </header>

      <section className="detalle-grid">
        <figure className="detalle-image">
          <img src={imagen || "/img/lebronLogo.png"} alt={nombre} loading="lazy" />
        </figure>

        <article className="detalle-info">
          <section className="detalle-price">
            <strong className="detalle-price__value">$ {formattedPrice}</strong>
          </section>

          <section className="detalle-selection">
            {tamanos.length ? (
              <DropdownSelector
                label="Tamaño"
                options={tamanos}
                value={selectedSize}
                onSelect={setSelectedSize}
              />
            ) : null}

            {sabores.length ? (
              <DropdownSelector
                label="Sabor"
                options={sabores}
                value={selectedFlavor}
                onSelect={setSelectedFlavor}
              />
            ) : null}

            {versionOptions.length ? (
              <DropdownSelector
                label="Versión"
                options={versionOptions}
                value={selectedVersion}
                onSelect={setSelectedVersion}
              />
            ) : null}

            {colorOptions.length ? (
              <DropdownSelector
                label="Color"
                options={colorOptions}
                value={selectedColor}
                onSelect={setSelectedColor}
              />
            ) : null}

            {materialOptions.length ? (
              <DropdownSelector
                label="Material"
                options={materialOptions}
                value={selectedMaterial}
                onSelect={setSelectedMaterial}
              />
            ) : null}
          </section>

          <ul className="detalle-meta">
            {marca && (
              <li>
                <span>Marca:</span> {marca}
              </li>
            )}
            {typeof stock === "number" && (
              <li>
                <span>Stock:</span> {stock}
              </li>
            )}
          </ul>

          <p className="detalle-notes">
            Precio valido abonando en efectivo o transferencia. Consultar por cuotas y
            disponibilidad de stock.
          </p>
          <article className="detalle-actions">
            <Boton variant="primary" onClick={handleAddToCart} altText="Agregar al carrito" disabled={stock <= 0 || producto.disponible === false}>
              Agregar al carrito
            </Boton>
            <Boton onClick={handleComprar} effect={false} disabled={stock <= 0 || producto.disponible === false}>
              Continuar pedido
            </Boton>
          </article>
        </article>
      </section>

      <section className="detalle-related">
        <ProductosDestacados />
      </section>
    </main>
  );
}

function DropdownSelector({ label, options = [], value, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (options.length && !options.includes(value)) {
      onSelect(options[0]);
    }
  }, [options, value, onSelect]);

  const handleSelect = (option) => {
    onSelect(option);
    setOpen(false);
  };

  return (
    <fieldset className="detalle-dropdown" ref={wrapperRef}>
      <legend className="detalle-dropdown__title">{label}</legend>
      <button
        type="button"
        className="detalle-dropdown__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="detalle-dropdown__value">{value || "Seleccionar"}</span>
        <span className="detalle-dropdown__icon" aria-hidden="true" />
      </button>
      {options.length > 0 && (
        <section
          className={`detalle-dropdown__panel ${open ? "is-open" : ""}`}
          role="presentation"
          aria-hidden={!open}
        >
          <ul className="detalle-dropdown__list" role="listbox">
            {options.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className="detalle-dropdown__item"
                  onClick={() => handleSelect(option)}
                  role="option"
                  aria-selected={option === value}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </fieldset>
  );
}
