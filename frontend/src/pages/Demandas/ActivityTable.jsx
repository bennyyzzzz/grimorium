import Badge, { ImportanceBadge, StatusBadge } from '../../components/Badge/Badge.jsx';
import { formatDateKey } from '../../utils/date.js';
import { QUICK_ACTION, activitySubtitle as subtitle } from './activityView.js';

/**
 * Tabela de demandas e contatos.
 * Com `selectable` (modo de seleção para exportar): mostra as caixas de seleção,
 * o clique na linha marca/desmarca o item e as ações rápidas ficam ocultas.
 */
export default function ActivityTable({
  activities,
  onOpen,
  onQuickStatus,
  busyId,
  selectable = false,
  selected,
  onSelect,
}) {
  const allSelected = activities.length > 0 && activities.every((a) => selected.has(a.id));
  const someSelected = !allSelected && activities.some((a) => selected.has(a.id));

  const activate = (a) => (selectable ? onSelect([a.id], !selected.has(a.id)) : onOpen(a));

  return (
    <div className="table-wrap">
      <table className={`table activity-table${selectable ? ' is-selecting' : ''}`}>
        <thead>
          <tr>
            {selectable && (
              <th className="cell-select">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os itens visíveis"
                  checked={allSelected}
                  ref={(el) => el && (el.indeterminate = someSelected)}
                  onChange={(e) => onSelect(activities.map((a) => a.id), e.target.checked)}
                />
              </th>
            )}
            <th>Demanda</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Prazo</th>
            <th>Último registro</th>
            {!selectable && <th aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => {
            const action = QUICK_ACTION[a.status];
            const sub = subtitle(a);
            const isSelected = selectable && selected.has(a.id);
            const className = [a.isOverdue && 'row-overdue', isSelected && 'row-selected'].filter(Boolean).join(' ');
            return (
              <tr
                key={a.id}
                className={className || undefined}
                onClick={() => activate(a)}
                tabIndex={0}
                aria-selected={selectable ? isSelected : undefined}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || (selectable && e.key === ' ')) {
                    e.preventDefault();
                    activate(a);
                  }
                }}
              >
                {selectable && (
                  <td className="cell-select" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${a.title}`}
                      checked={isSelected}
                      onChange={(e) => onSelect([a.id], e.target.checked)}
                    />
                  </td>
                )}
                <td>
                  <div className="cell-title">{a.title}</div>
                  {sub && <div className={`cell-sub${a.type === 'CONTACT' ? ' cell-sub-contact' : ''}`}>{sub}</div>}
                </td>
                <td>
                  <ImportanceBadge value={a.importance} />
                </td>
                <td>
                  <StatusBadge value={a.status} />
                </td>
                <td className="cell-due">
                  {a.dueDate ? (
                    <span className={a.isOverdue ? 'text-danger' : undefined}>{formatDateKey(a.dueDate)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {a.isOverdue && <Badge tone="danger">Atrasada</Badge>}
                </td>
                <td className="muted">{a.lastExecutionDate ? formatDateKey(a.lastExecutionDate) : '—'}</td>
                {!selectable && (
                  <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
                    {action && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyId === a.id}
                        onClick={() => onQuickStatus(a, action.status)}
                      >
                        {action.label}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
