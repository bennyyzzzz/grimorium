import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApiHealth } from '../../hooks/useApiHealth.js';
import { LORE } from '../../constants/lore.js';
import Sigil from '../Summoning/Sigil.jsx';
import ThemeToggle from '../ThemeToggle/ThemeToggle.jsx';
import './Layout.css';

function NavIcon({ children }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <NavIcon>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </NavIcon>
    ),
  },
  {
    to: '/demandas',
    label: 'Demandas',
    icon: (
      <NavIcon>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
      </NavIcon>
    ),
  },
  {
    to: '/biblioteca',
    label: 'Biblioteca',
    icon: (
      <NavIcon>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 21h13" />
        <path d="M9 7h6" />
      </NavIcon>
    ),
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: (
      <NavIcon>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </NavIcon>
    ),
  },
];

const STATUS_LABEL = {
  checking: LORE.summoning,
  ok: 'API e banco online',
  degraded: 'Banco indisponível',
  offline: 'API offline',
};

export default function Layout() {
  const health = useApiHealth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sigil className="brand-sigil" />
          </span>
          Grimorium
        </div>
        <nav className="nav" aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ThemeToggle />
          <p className="data-note">
            Dados salvos apenas neste computador, sem nuvem.{' '}
            <Link to="/demandas?backup=1">Fazer backup</Link>
          </p>
          <div className={`health health-${health}`} title="Status da conexão com o backend">
            <span className="health-dot" />
            {STATUS_LABEL[health]}
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
