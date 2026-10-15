import React, { useState, useEffect } from "react";
import "../../assets/css/atomicos/carrusel.css";

export default function Carrusel({
  items = [],
  autoPlay = true,
  intervalo = 9000,
  className = "",
}) {
  const [index, setIndex] = useState(0);

  const current = items[index];
  const texto = current?.texto ?? current?.descripcion ?? current?.subtitulo;

  useEffect(() => {
    if (!autoPlay || !items.length) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), intervalo);
    return () => clearInterval(timer);
  }, [items.length, autoPlay, intervalo]);

  if (!items || items.length === 0) return null;

  return (
    <section
      className={`lb-carrusel ${className}`}
      style={{ backgroundImage: `url(${current.img})` }}
      aria-label="Carrusel Lebron"
    >
      <span className="lb-overlay" aria-hidden={true}></span>

      <figure className="lb-main-wrap">
        <img className="lb-img" src={current.img} alt={current.titulo} />
      </figure>
      <article className="contenedor-carrusel">
        <aside className="lb-side" aria-label="Descripción del slide">
          <h3 className="lb-side-title">{current.titulo}</h3>
          {texto && <p className="lb-side-text">{texto}</p>}
        </aside>


      </article>
    </section>
  );
}
