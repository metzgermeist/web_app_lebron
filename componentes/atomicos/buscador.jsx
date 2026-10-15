import React, { useMemo, useRef, useState } from "react";
import "../../assets/css/atomicos/buscador.css"; // Asegúrate que esta ruta sea correcta

import { useNavigate, Link } from "react-router-dom";
import { useCatalog } from "../../src/context/CatalogContext.jsx";

export default function Buscador({
  placeholder = "Buscar...",
  value,
  onChange,
  onSubmit,
  className = "",
  ariaLabel = "Buscar",
  allItems: suppliedItems,
}) {
  const { products } = useCatalog();
  const allItems = suppliedItems || products;
  const navigate = useNavigate();
  const [internal, setInternal] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const norm = (s) => (s || "").toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pretty = (s) => (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  // Determina si el componente es controlado o no
  const val = value !== undefined ? value : internal;
  const hasText = val && val.trim().length > 0;

  // Sugerencias por categoría, nombre o marca (dinámicas, sin tildes)
  const filteredSuggestions = useMemo(() => {
    if (!hasText || val.trim().length < 1) return [];
    const q = norm(val);

    // Categorías únicas del dataset
    const cats = Array.from(new Set((allItems || []).map(i => norm(i.categoria))));
    const catSugs = cats
      .filter(c => c.includes(q))
      .map(c => ({ id: `cat-${c}`, nombre: pretty(c), categoria: 'Categoría', kind: 'cat', slug: c }));

    // Marcas: usar campo marca si existe o heurística en el nombre
    const brandKeys = ["optimum nutrition","optimum","universal","gat","redcon1","scivation","dymatize","gnc","starlabs","animal","on"];
    const brandSet = new Set();
    for (const it of (allItems || [])) {
      const n = norm(it.nombre);
      if (it.marca) brandSet.add(norm(it.marca));
      for (const b of brandKeys) if (n.includes(b)) brandSet.add(b);
    }
    const brandSugs = Array.from(brandSet)
      .filter(b => b.includes(q))
      .map(b => ({ id: `brand-${b}`, nombre: pretty(b), categoria: 'Marca', kind: 'brand', slug: b }));

    // Combinar (solo categorías y marcas) y limitar
    const combined = [...catSugs, ...brandSugs];
    const seen = new Set();
    const uniq = [];
    for (const s of combined) { const key = `${s.id}-${s.nombre}`; if (!seen.has(key)) { seen.add(key); uniq.push(s); } }
    return uniq.slice(0, 5);
  }, [val, allItems, hasText]);

  // Mostrar lista apenas hay texto + resultados (desktop y mobile)
  const showList = hasText && filteredSuggestions.length > 0;

  // --- Manejadores de Eventos ---

  const handleChange = (e) => {
    if (onChange) onChange(e); // controlado
    else setInternal(e.target.value); // no controlado
    setFocused(true);
  };

  const setValue = (newVal) => {
    if (onChange) {
      // Simular un evento para que el padre lo reciba de forma consistente
      onChange({ target: { value: newVal } });
    } else {
      setInternal(newVal);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(val);
    const q = norm(val);
    const cats = Array.from(new Set((allItems || []).map(i => norm(i.categoria))));
    const firstCat = cats.find(c => c.includes(q) || c === q);
    if (q) navigate(`/categoria/${firstCat || q}`);
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setValue("");
    setFocused(false);
    inputRef.current?.blur();
  };

  // --- Clases CSS Dinámicas ---
  
  const classes = useMemo(() => {
    return ["lb-search", focused ? "is-focus" : "", className]
      .filter(Boolean)
      .join(" ");
  }, [focused, className]);

  // --- Renderizado ---

  return (
    <form
      ref={containerRef}
      className={classes}
      role="search"
      aria-label={ariaLabel}
      onSubmit={handleSubmit}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        // Delay para permitir click en sugerencias y luego cerrar limpiando
        setTimeout(() => {
          const stillInside = containerRef.current?.contains(document.activeElement);
          if (!stillInside) {
            // Cerrar y limpiar siempre que se pierda el foco
            handleClear();
          }
        }, 150);
      }}
    >
      {/* Icono de Lupa / Limpiar */}
      <span className="lb-bar" aria-hidden={true}>
        <button
          type="button"
          className="lb-icon-btn"
          tabIndex={-1}
          aria-label={hasText ? "Limpiar" : "Buscar"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            handleClear();
          }}
        >
          <span className="lb-icon" />
        </button>
      </span>

      {/* Input Principal */}
      <input
        className="lb-search-input"
        type="text"
        placeholder={placeholder}
        value={val}
        onChange={handleChange}
        aria-label={ariaLabel}
        role="searchbox"
        inputMode="search"
        ref={inputRef}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClear();
        }}
      />

      {/* Lista de Sugerencias */}
      {showList && (
        <ul className="lb-suggest">
          {filteredSuggestions.map((sug, index) => {
            const path = sug.kind === 'cat' ? `/categoria/${sug.slug}` : `/categoria/${norm(sug.slug || sug.nombre)}`;
            return (
              <li key={`${sug.id}-${index}`}>
                <Link
                  className="lb-suggest-link"
                  to={path}
                  onClick={() => {
                    // cerrar y limpiar al navegar
                    setValue("");
                    setFocused(false);
                  }}
                >
                  <span className="suggestion-name">{sug.nombre}</span>
                  {sug.categoria && (
                    <span className="suggestion-category">{sug.categoria}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
