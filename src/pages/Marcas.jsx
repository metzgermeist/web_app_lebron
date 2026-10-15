import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import "../../assets/css/pages/Marcas.css";

export default function Marcas() {
  const { products } = useCatalog();
  const { brands } = useMemo(() => {
    const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const pretty = (s) => (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

    const map = new Map();
    for (const p of products || []) {
      const raw = (p.marca || "").trim();
      if (!raw) continue;
      const key = norm(raw);
      const entry = map.get(key) || { key, name: pretty(raw), count: 0 };
      entry.count += 1;
      map.set(key, entry);
    }
    const list = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
    return { brands: list };
  }, [products]);

  return (
    <main className="section" style={{ padding: "2rem 1rem" }}>
      <section className="container" style={{ maxWidth: 960, marginInline: "auto" }}>
        <header style={{ textAlign: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Marcas</h2>
          <p style={{ margin: ".25rem 0 0", color: "#e1cbcd" }}>{brands.length} marcas encontradas</p>
        </header>

        <ul className="marcas-grid">
          {brands.map((b) => (
            <li key={b.key} className="marcas-card">
              <Link
                className="marcas-card__link"
                to={`/categoria/${b.key}`}
                aria-label={`Ver productos de ${b.name}`}
              >
                <span>{b.name}</span>
                <span>{b.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
