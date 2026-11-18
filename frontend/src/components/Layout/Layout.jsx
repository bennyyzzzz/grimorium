import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApiHealth } from '../../hooks/useApiHealth.js';
import { LORE } from '../../constants/lore.js';
import Sigil from '../Summoning/Sigil.jsx';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/demandas', label: 'Demandas' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/relatorios', label: 'Relatórios' },
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
          <Sigil className="brand-sigil" />
          Grimorium
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
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
