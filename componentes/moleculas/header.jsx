import banner from "../../assets/img/banner2.png";
import Boton from "../atomicos/boton.jsx";
import "../../assets/css/moleculas/header.css";

function Header() {
  return (
    <header className="hero">
  <section className="hero-gradient" aria-hidden={true}></section>
      <section className="container hero-inner">
        <section>
          <p className="kicker">
            <span className="dot"></span> Suplementos de alto rendimiento
          </p>
          <h1 className="title title-hero">
            <span>Potenciá</span>
            <span>tu rendimiento</span>
          </h1>
          <p className="subtitle">
            Energia, fuerza y recuperacion para quienes entrenan en serio.
          </p>
          <section className="cta-row" aria-label="Llamadas a la accion">
            <Boton variant="black-friday" href="#categorias" altText="Ir a comprar">
              Comprar ahora
            </Boton>
            <Boton variant="black-friday" href="/categoria/combos" altText="Explorar combos">
              Ver combos
            </Boton>
          </section>
          <p className="trust-row">
            <span>&#10003; Ingredientes certificados</span>
            <span>&#10003; Sin azucares anadidos</span>
            <span>&#10003; Apto vegetarianos</span>
          </p>
        </section>
          <section className="hero-card">
          <section className="product-mock" aria-hidden={true}>
            <img src={banner} alt="Producto principal" />
          </section>
        </section>
      </section>
    </header>
  );
}

export default Header;
