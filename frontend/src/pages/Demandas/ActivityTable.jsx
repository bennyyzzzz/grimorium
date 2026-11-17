import Badge, { ImportanceBadge, StatusBadge } from '../../components/Badge/Badge.jsx';
import { CHANNEL } from '../../constants/activity.js';
import { formatDateKey } from '../../utils/date.js';

// Linha secundária: para contatos, "Contato · WhatsApp · Maria · Categoria"; para demandas, a categoria.
function subtitle(a) {
  const parts =
    a.type === 'CONTACT' ? ['Contato', CHANNEL[a.channel]?.label, a.contactName, a.category] : [a.category];
  return parts.filter(Boolean).join(' · ');
}

const QUICK_ACTION = {
  PENDING: { status: 'IN_PROGRESS', label: 'Iniciar' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Concluir' },
};

export default function ActivityTable({ activities, onOpen, onQuickStatus, busyId }) {
  return (
    <div className="table-wrap">
      <table className="table activity-table">
        <thead>
          <tr>
            <th>Demanda</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Prazo</th>
            <th>Último registro</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => {
            const action = QUICK_ACTION[a.status];
            const sub = subtitle(a);
            return (
              <tr
                key={a.id}
                className={a.isOverdue ? 'row-overdue' : undefined}
                onClick={() => onOpen(a)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}
              >
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
