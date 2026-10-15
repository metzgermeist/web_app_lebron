// componentes/moleculas/Categorias.jsx
import protein from "../../assets/img/protein (1).png";
import alimentos from "../../assets/img/alimentos (2).png";
import creatina from "../../assets/img/creatina (1).png";
import preentreno from "../../assets/img/preenterno2 (1).png";
import amino from "../../assets/img/amino (1).png";
import vitaminas from "../../assets/img/vitaminas (1).png";
import accesorios from "../../assets/img/accesorios (1).png";
import quemadores from "../../assets/img/quemadorr (1).png";
import Tarjeta from "../atomicos/tarjeta.jsx";
import "../../assets/css/moleculas/categorias.css";
import { useCatalog } from "../../src/context/CatalogContext.jsx";

export default function Categorias() {
  const { products } = useCatalog();
  const categorias = [
    { nombre: "Proteinas", imagen: protein, alt: "Proteinas", slug: "proteinas", descripcion: "Marcas: ON, ENA, Star, UltraTech, Mervick", descuento: "30% de descuento" },
    { nombre: "Alimentos", imagen: alimentos, alt: "Alimentos", slug: "alimentos", descripcion: "Harina de avena, peanut butter, barras, snacks fit", descuento: "20% de descuento" },
    { nombre: "Vitaminas", imagen: vitaminas, alt: "Vitaminas", slug: "vitaminas", descripcion: "Multivitaminicos, Omega 3, Vitamina C y D3", descuento: "25% de descuento" },
    { nombre: "Creatinas", imagen: creatina, alt: "Creatinas", slug: "creatinas", descripcion: "Monohidratada, micronizada. Marcas: ENA, Star, UltraTech", descuento: "35% de descuento" },
    { nombre: "Aminoacidos", imagen: amino, alt: "Aminoacidos", slug: "aminoacidos", descuento: "18% de descuento" },
    { nombre: "Pre-entrenos", imagen: preentreno, alt: "Pre-entrenos", slug: "preentrenos", descripcion: "Energizantes, bombas de oxido nitrico,focus", descuento: "40% de descuento" },
    { nombre: "Quemadores", imagen: quemadores, alt: "Quemadores", slug: "quemadores", descripcion: "L-carnitina, termogenicos, diureticos", descuento: "15% de descuento" },
    { nombre: "Accesorios", imagen: accesorios, alt: "Accesorios", slug: "accesorios", descripcion: "Shakers, cinturones, guantes, munhequeras", descuento: "22% de descuento" },
  ];

  // Mostrar solo categorías que existan en el JSON real
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const available = [...new Set(products.map(product => normalize(product.categoria)))];
  const visibles = available.map(slug => categorias.find(category => category.slug === slug) || {
    slug, nombre: products.find(product => normalize(product.categoria) === slug).categoria,
    imagen: protein, alt: slug, descripcion: 'Explorá los productos de esta categoría.',
  });

  return (
    <section id="categorias" className="section">
      <section className="container categories-wrap">
        <h1>Categorias destacadas</h1>
        <h2>Encontrá tus suplementos</h2>
        <section className="categories-grid" aria-label="Listado de categorias">
          {visibles.map((cat) => (
            <Tarjeta
              key={cat.slug}
              titulo={cat.nombre}
              subtitulo={cat.alt}
              descripcion={cat.descripcion}
              imagen={cat.imagen}
              href={`/categoria/${cat.slug}`}
            />
          ))}
        </section>
      </section>
    </section>
  );
}
