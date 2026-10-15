import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import TarjetaProducto from "../../componentes/atomicos/tarjetaproductos.jsx";
import "../../assets/css/atomicos/tarjetaproducto.css";
import "../../assets/css/pages/Generica.css";

export default function Generica() {
  const { products } = useCatalog();
  const { nombre } = useParams();

  const { slug, title, items, groupedByCategory, isCategorySlug, isBrandView } = useMemo(() => {
    const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const pretty = (s) => (s || "").replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const slug = norm(nombre || "");
    const categories = new Set((products || []).map((p) => norm(p.categoria)));

    const brands = new Map();
    for (const product of products || []) {
      const rawBrand = (product.marca || "").trim();
      if (!rawBrand) continue;
      const key = norm(rawBrand);
      if (!brands.has(key)) {
        brands.set(key, pretty(rawBrand));
      }
    }

    // Heurística simple de marca desde el nombre
    const brandKeys = [
      "optimum nutrition", "optimum", "universal", "gat", "redcon1", "scivation",
      "dymatize", "gnc", "starlabs", "animal", "on"
    ];
    const getBrand = (name) => {
      const n = norm(name);
      const hit = brandKeys.find((b) => n.includes(b));
      return hit || "";
    };

    const buildCategoryGroups = (list) => {
      const categoriesMap = new Map();
      for (const product of list) {
        const rawCategory = (product.categoria || "Sin categoría").trim();
        const key = norm(rawCategory);
        const name = pretty(rawCategory || "Sin categoría") || "Sin categoría";
        const entry = categoriesMap.get(key) || { key, name, items: [] };
        entry.items.push(product);
        categoriesMap.set(key, entry);
      }
      const groups = Array.from(categoriesMap.values()).filter((group) => group.items.length);
      groups.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
      return groups;
    };
    let items = [];
    let title = pretty(slug || "Resultados");
    let groupedByCategory = null;
    let isCategorySlug = false;
    const matchedBrand = brands.get(slug);
    const isBrandView = Boolean(matchedBrand && !categories.has(slug));
    if (categories.has(slug)) {
      // Filtro por categoría exacta
      items = (products || []).filter((p) => norm(p.categoria) === slug);
      title = pretty(slug);
      isCategorySlug = true;
    } else if (matchedBrand) {
      // Vista plana para marcas específicas y categorías
      items = (products || []).filter((p) => norm(p.marca || "") === slug);
      title = matchedBrand;
    } else {
      // Búsqueda por nombre o marca que contenga el término
      items = (products || []).filter(
        (p) =>
          norm(p.nombre).includes(slug) ||
          norm(p.marca || "").includes(slug) ||
          getBrand(p.nombre).includes(slug)
      );
      title = `Resultados: ${pretty(slug)}`;
      groupedByCategory = buildCategoryGroups(items);
    }
    if (matchedBrand) {
      groupedByCategory = buildCategoryGroups(items);
      isCategorySlug = false;
    }

    return { slug, title, items, groupedByCategory, isCategorySlug, isBrandView };
  }, [nombre, products]);

  return (
    <main className="section" style={{ padding: "2rem 1rem" }}>
      <section className="container gen-wrap">
        <header className="gen-header">
          <h2 className="gen-title">{title}</h2>
          <p className="gen-sub">{items.length} productos encontrados</p>
        </header>

        {items.length ? (
          isCategorySlug ? (
            <ul className="gen-grid" role="list">
              {items.map((p) => (
                <li key={p.id} className="gen-grid-item">
                  <TarjetaProducto producto={p} categoria={slug} variant="category" />
                </li>
              ))}
            </ul>
          ) : (
            groupedByCategory && groupedByCategory.length ? (
              <div className="generica-categories">
                {groupedByCategory.map((group) => (
                  <article key={group.key || group.name} className="generica-category">
                    <header className="generica-category__header">
                      <h3>{group.name}</h3>
                      <span className="generica-category__count">{group.items.length} producto{group.items.length === 1 ? "" : "s"}</span>
                    </header>
                      <ul className="gen-grid" role="list">
                        {group.items.map((p, index) => (
                          <li key={`${group.key}-${p.id}-${index}`} className="gen-grid-item">
                            <TarjetaProducto
                              producto={p}
                              categoria={group.key}
                              variant={isBrandView ? "brand" : "category"}
                            />
                          </li>
                        ))}
                      </ul>
                  </article>
                ))}
              </div>
            ) : (
              <p className="gen-empty">No hay productos para esta búsqueda.</p>
            )
          )
        ) : (
          <p className="gen-empty">No hay productos para esta categoría.</p>
        )}
      </section>
    </main>
  );
}
