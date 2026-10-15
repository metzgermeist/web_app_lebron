import "../../assets/css/atomicos/links.css";
import { Link } from "react-router-dom";

// Iconos SVG inline (visibles por defecto, se ocultan al hover cuando aparece el texto)
const IconDumbbell = () => (
  <svg viewBox="0 0 24 24" aria-hidden={true}>
    <path d="M2 9h2v6H2zM20 9h2v6h-2zM7 10h10v4H7zM4 10h3v4H4zM17 10h3v4h-3z" />
  </svg>
);

const IconApple = () => (
  <svg viewBox="0 0 24 24" aria-hidden={true}>
    <path d="M16.5 13.5c-.7 1.7-1.8 3.1-3 3.1-1.1 0-1.4-.7-2.6-.7-1.3 0-1.6.7-2.7.7-1.2 0-2.1-1.2-2.8-2.7C4.5 12 4 10.2 5 8.8c.8-1.3 2.1-2 3.3-2 .9 0 1.8.6 2.4.6.6 0 1.6-.7 2.8-.7 1 0 2 .5 2.7 1.3-2.4 1.3-2.2 4.5-.7 6.2z" />
    <path d="M14.8 3.2c.3 1.1-.3 2.3-1 3 .9.1 1.9-.5 2.4-1.2.5-.7.7-1.8.5-2.7-.9.1-1.9.6-1.9.9z" />
  </svg>
);

const IconBag = () => (
  <svg viewBox="0 0 24 24" aria-hidden={true}>
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

const IconTag = () => (
  <svg viewBox="0 0 24 24" aria-hidden={true}>
    <path d="M3 12l9-9h6l3 3v6l-9 9L3 12z" />
    <circle cx="17" cy="7" r="1.5" />
  </svg>
);

const IconPuzzle = () => (
  <svg viewBox="0 0 24 24" aria-hidden={true}>
    <path d="M9 3h3a2 2 0 0 1 2 2v1h1a2 2 0 1 1 0 4h-1v2h2v-1a2 2 0 1 1 4 0v3h-3v3h-3v-3H9v3H6v-3H3v-3h3V9H3V6h3V5a2 2 0 0 1 2-2z" />
  </svg>
);

function Links({
  open = false,
  items = [
    { href: "#categorias",           label: "Suplementos", icon: <IconDumbbell />, gradA: "#f8384b", gradB: "#d81d30"  },
    { href: "/categoria/alimentos", label: "Alimentos",  icon: <IconApple />,    gradA: "#ed3a4c", gradB: "#951d29" },
    { href: "/categoria/accesorios",label: "Accesorios", icon: <IconBag />,      gradA: "#e90e24", gradB: "#eb2539"  },
    { href: "/marcas",              label: "Marcas",      icon: <IconTag />,      gradA: "#f75565", gradB: "#d9283a" },
    { href: "/categoria/combos",     label: "Combos",      icon: <IconPuzzle />,   gradA: "#fa606f", gradB: "#eb2539" },
  ],
  onItemClick,
  activeIndex = -1,
}) {
    const palette = [
        ["#f8384b", "#d81d30"],
        ["#f75565", "#ed3a4c"],
        ["#e90e24", "#eb2539"],
        ["#f16371", "#e54656"],
        ["#fc8490", "#ed3a4c"],
    ];

  const finalItems = items.map((it, idx) => ({
    ...it,
    gradA: it.gradA || palette[idx % palette.length][0],
    gradB: it.gradB || palette[idx % palette.length][1],
  }));

  return (
    <ul className={`nav-links container ${open ? "is-open" : ""}`}>
      {finalItems.map((it, idx) => (
        <li
          key={it.href + it.label}
          className={`nav-item ${idx === activeIndex ? "is-active" : ""}`}
          style={{ "--grad-a": it.gradA, "--grad-b": it.gradB }}
        >
          {String(it.href || "").startsWith("/") ? (
            <Link
              className="link-pill"
              to={it.href}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                if (onItemClick) onItemClick(e);
                try { e.currentTarget.blur(); } catch { /* La navegaci?n puede continuar sin cambiar el foco. */ }
              }}
              aria-label={it.label}
            >
              <span className="link-icon" aria-hidden={true}>{it.icon}</span>
              <span className="link-title">{it.label}</span>
            </Link>
          ) : (
            <a
              className="link-pill"
              href={it.href}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                if (onItemClick) onItemClick(e);
                try { e.currentTarget.blur(); } catch { /* La navegaci?n puede continuar sin cambiar el foco. */ }
              }}
              aria-label={it.label}
            >
              <span className="link-icon" aria-hidden={true}>{it.icon}</span>
              <span className="link-title">{it.label}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export default Links;
export { Links };





