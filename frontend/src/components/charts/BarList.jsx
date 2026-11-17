import './charts.css';

/**
 * Barras horizontais de uma única série (ex.: atividades por prioridade).
 * Cor única: os rótulos nomeiam as categorias; o valor e o % ficam escritos ao lado.
 */
export default function BarList({ items, total, ariaLabel }) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="bar-list" aria-label={ariaLabel}>
      {items.map((item) => {
        const pct = total ? Math.round((item.value / total) * 100) : null;
        return (
          <li key={item.label} className="bar-list-row">
            <span className="bar-list-label">{item.label}</span>
            <span className="bar-list-track" aria-hidden="true">
              {item.value > 0 && <span className="bar-list-fill" style={{ width: `${(item.value / max) * 100}%` }} />}
            </span>
            <span className="bar-list-value">
              {item.value}
              {pct !== null && <small>{pct}%</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
