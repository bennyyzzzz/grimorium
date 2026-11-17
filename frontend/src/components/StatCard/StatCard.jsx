import { Link } from 'react-router-dom';
import './StatCard.css';

// Card de indicador. Com `to`, vira atalho para a lista filtrada.
export default function StatCard({ label, value, hint, tone, to }) {
  const content = (
    <>
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${tone ? ` stat-value-${tone}` : ''}`}>{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );

  return to ? (
    <Link to={to} className="stat-card stat-card-link">
      {content}
    </Link>
  ) : (
    <div className="stat-card">{content}</div>
  );
}
