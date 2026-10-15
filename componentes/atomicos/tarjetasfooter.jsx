import "../../assets/css/atomicos/tarjetaFototer.css";
import RedesSocialesBoton from "./redesSocialesBoton.jsx";

const branches = [
  { title: "Casa Central", addr: "Av. Mitre 564", wa: "543816337883", aria: "Casa Central" },
  { title: "Sucursal 25 de Mayo", addr: "25 de Mayo 762", wa: "543814156163", aria: "25 de Mayo 762" },
  { title: "Sucursal Lules", addr: "Belgrano 354", wa: "543816312150", aria: "Lules" },
];

function TarjetasFooter() {
  return (
    <nav id="sucursales" aria-label="Sucursales">
      <strong>Sucursales</strong>
      <ul className="tf-grid" role="list">
        {branches.map((s, i) => (
          <li key={i} className="tf-card">
            <address className="tf-text">
              <span className="tf-title">{s.title}</span>
              <span className="tf-addr">{s.addr}</span>
            </address>
            {s.wa && (
              <aside className="tf-actions">
                <RedesSocialesBoton include={["whatsapp"]} whatsappUrl={`https://wa.me/${s.wa}`} />
              </aside>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default TarjetasFooter;
