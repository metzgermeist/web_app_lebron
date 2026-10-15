import { useEffect, useId, useRef, useState } from "react";
import "../../assets/css/moleculas/navMobile.css";
import "../../componentes/atomicos/buscador.jsx";
import "../../assets/css/atomicos/buscador.css";
import BotonCarrito from "../atomicos/botoncarrito.jsx";

const PRIMARY_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#categorias", label: "Categorias" },
  { href: "/categoria/combos", label: "Combos" },
  { href: "/#gancho", label: "Porque estoy aqui?" },
];

const QUICK_ACTIONS = [
  {
    href: "https://wa.me/5490000000000",
    label: "Casa Central",
    type: "whatsapp",
  },
];

function NavMobile() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const paneRef = useRef(null);
  const titleId = useId();
  const headingId = `fan-nav-heading-${titleId}`;
  const paneId = `fan-nav-pane-${titleId}`;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        try { toggleRef.current?.focus(); } catch { /* La navegaci?n puede continuar sin cambiar el foco. */ }
        setTimeout(() => setOpen(false), 0);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("lb-mobile-lock", open);
    return () => {
      document.body.classList.remove("lb-mobile-lock");
    };
  }, [open]);

  useEffect(() => {
    const contentRoot =
      document.querySelector("main") ||
      document.getElementById("root") ||
      document.body;

    if (open) {
      requestAnimationFrame(() => {
        const firstFocusable = paneRef.current?.querySelector(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          paneRef.current?.focus();
        }
      });

      try {
        if ("inert" in contentRoot) {
          contentRoot.inert = true;
        } else {
          contentRoot.setAttribute("aria-hidden", "true");
        }
      } catch {
        contentRoot.setAttribute("aria-hidden", "true");
      }
    } else {
      try {
        if ("inert" in contentRoot) {
          contentRoot.inert = false;
        } else {
          contentRoot.removeAttribute("aria-hidden");
        }
      } catch {
        contentRoot.removeAttribute("aria-hidden");
      }
    }

    return () => {
      try {
        if ("inert" in contentRoot) {
          contentRoot.inert = false;
        } else {
          contentRoot.removeAttribute("aria-hidden");
        }
      } catch {
        contentRoot.removeAttribute("aria-hidden");
      }
    };
  }, [open]);

  const closeMenu = (focusToggle = false) => {
    if (focusToggle) {
      try { toggleRef.current?.focus(); } catch { /* La navegaci?n puede continuar sin cambiar el foco. */ }
    }
    setTimeout(() => setOpen(false), 0);
  };

  return (
    <section
      className={`fan-nav ${open ? "is-open" : ""}`}
      aria-label="Menu movil"
    >
      <button
        ref={toggleRef}
        type="button"
        className="fan-nav__toggle"
        aria-expanded={open}
        aria-controls={paneId}
        aria-label={open ? "Cerrar menu movil" : "Abrir menu movil"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="fan-nav__toggle-lines" aria-hidden="true" />
      </button>

      <div className="fan-nav__cart-wrapper">
        <BotonCarrito
          className="fan-nav__cart-btn"
          iconOnly
          ariaLabel="Ir al carrito de compras"
        />
      </div>

      <section
        ref={paneRef}
        id={paneId}
        className="fan-nav__pane"
        tabIndex={-1}
        aria-modal={open ? "true" : undefined}
        aria-labelledby={headingId}
        role="dialog"
      >
        <header className="fan-nav__header">
          <span className="fan-nav__eyebrow">Explora Lebron</span>
          <h2 id={headingId} className="fan-nav__title">
            Potencia tu rutina
          </h2>
          

        </header>

        <nav className="fan-nav__nav">
          <ul className="fan-nav__links">
            {PRIMARY_LINKS.map((link, index) => (
              <li
                key={`${link.href}-${link.label}`}
                className="fan-nav__item"
                style={{ "--item-index": index }}
              >
                <a
                  className="fan-nav__link"
                  href={link.href}
                  onClick={() => closeMenu(true)}
                >
                  <span className="fan-nav__link-label">{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="fan-nav__quick" aria-label="Accesos directos">
          {QUICK_ACTIONS.map((action) => (
            <a
              key={`${action.href}-${action.label}`}
              className="fan-nav__chip"
              href={action.href}
              onClick={() => closeMenu(true)}
              target={action.type === "whatsapp" ? "_blank" : undefined}
              rel={
                action.type === "whatsapp" ? "noopener noreferrer" : undefined
              }
              aria-label={action.label}
            >
              {action.label}
            </a>
          ))}
        </footer>
      </section>

      <div
        className="fan-nav__scrim"
        aria-hidden={!open}
        role="presentation"
        onClick={() => closeMenu(true)}
      />
    </section>
  );
}

export default NavMobile;


