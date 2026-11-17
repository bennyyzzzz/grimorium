import { useState } from 'react';
import './charts.css';

/**
 * Colunas de uma única série ao longo do tempo (ex.: atividades executadas por dia).
 * - Tooltip por coluna ao passar o mouse/focar (alvo = coluna inteira, maior que a barra).
 * - Rótulos seletivos no eixo X (primeiro, meio, último) para não colidir.
 * - Tabela equivalente para leitores de tela.
 */
export default function ColumnChart({ data, formatLabel, formatTooltipLabel = formatLabel, valueLabel, caption }) {
  const [active, setActive] = useState(null);
  const top = Math.max(1, ...data.map((d) => d.value));
  const mid = top >= 2 ? Math.round(top / 2) : null;
  const xLabelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  const activeItem = active !== null ? data[active] : null;

  return (
    <figure className="column-chart">
      <div className="column-chart-body">
        <div className="column-chart-yaxis" aria-hidden="true">
          <span style={{ bottom: '100%' }}>{top}</span>
          {mid !== null && <span style={{ bottom: `${(mid / top) * 100}%` }}>{mid}</span>}
          <span style={{ bottom: 0 }}>0</span>
        </div>

        <div className="column-chart-plot" onMouseLeave={() => setActive(null)}>
          <div className="column-chart-grid" aria-hidden="true">
            <span style={{ bottom: '100%' }} />
            {mid !== null && <span style={{ bottom: `${(mid / top) * 100}%` }} />}
            <span style={{ bottom: 0 }} />
          </div>

          <div className="column-chart-columns" aria-hidden="true">
            {data.map((d, i) => (
              <div
                key={d.label}
                className={`column-chart-slot${active === i ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
              >
                {d.value > 0 && <div className="column-chart-bar" style={{ height: `${(d.value / top) * 100}%` }} />}
              </div>
            ))}
          </div>

          {activeItem && (
            <div
              className="chart-tooltip"
              style={{
                left: `${((active + 0.5) / data.length) * 100}%`,
                bottom: `${(activeItem.value / top) * 100}%`,
              }}
            >
              <span>{formatTooltipLabel(activeItem.label)}</span>
              <strong>
                {activeItem.value} {valueLabel(activeItem.value)}
              </strong>
            </div>
          )}
        </div>
      </div>

      <div className="column-chart-xaxis" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.label}>{xLabelIndexes.has(i) ? formatLabel(d.label) : ''}</span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{formatTooltipLabel(d.label)}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
