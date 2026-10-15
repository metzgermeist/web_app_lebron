import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Buscador from "../atomicos/buscador.jsx";
import { useCatalog } from "../../src/context/CatalogContext.jsx";
import "../../assets/css/moleculas/comprador.css";

export default function Comprador({
  titulo = "\u00BFQu\u00E9 buscas?",
  placeholder = "Buscar por producto, categor\u00EDa o marca...",
  ariaLabel = "Buscar en Lebron",
  className = "",
}) {
  const { products } = useCatalog();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const norm = (s) => (s || "").toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const pretty = (s) => (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  const handleQueryChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    const normQuery = norm(newQuery);
    if (normQuery.length > 1) {
      // Categorías únicas del JSON
      const catSet = Array.from(new Set((products || []).map((p) => norm(p.categoria))));
      const catSugs = catSet
        .filter((c) => c.includes(normQuery))
        .map((c) => ({ id: `cat-${c}`, nombre: pretty(c), categoria: "Categoría", kind: "cat", slug: c }));

      // Productos que coincidan por nombre o categoría
      const prodSugs = (products || [])
        .filter(
          (p) => norm(p.nombre).includes(normQuery) || norm(p.categoria).includes(normQuery)
        )
        .map((p) => ({ id: `prod-${p.id}`, nombre: p.nombre, categoria: pretty(p.categoria), kind: "prod", slug: norm(p.categoria) }));

      // Limitar total a 10, priorizando categorías al inicio
      const combined = [...catSugs, ...prodSugs].slice(0, 10);
      setSuggestions(combined);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearchSubmit = (payload) => {
    // Puede venir como string (Enter) u objeto de sugerencia (click)
    if (payload && typeof payload === "object") {
      if (payload.kind === "cat") {
        navigate(`/categoria/${payload.slug}`);
      } else if (payload.kind === "prod") {
        navigate(`/categoria/${payload.slug}`);
      }
    } else {
      const q = norm(payload || "");
      if (q) navigate(`/categoria/${q}`);
    }
    setSuggestions([]);
    setQuery("");
  };

  return (
    <section id="comprador" className={["lb-comprador", className].filter(Boolean).join(" ")}>
      <div className="lb-comprador-inner">
        <h2 className="lb-comprador-title">{titulo}</h2>
        <Buscador
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          value={query}
          onChange={handleQueryChange}
          suggestions={suggestions}
          onSubmit={handleSearchSubmit}
        />
      </div>
    </section>
  );
}
