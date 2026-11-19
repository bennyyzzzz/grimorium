import { useState } from 'react';
import Badge, { ImportanceBadge } from '../../components/Badge/Badge.jsx';
import { STATUS } from '../../constants/activity.js';
import { formatDateKey } from '../../utils/date.js';
import { QUICK_ACTION, activitySubtitle } from './activityView.js';

const COLUMNS = Object.keys(STATUS); // PENDING, IN_PROGRESS, COMPLETED, CANCELED
// Concluídas e canceladas crescem sem parar (contatos entram concluídos): mostra as primeiras e o resto sob demanda.
const CLOSED_LIMIT = 12;
const CLOSED = new Set(['COMPLETED', 'CANCELED']);

/**
 * Quadro Kanban: uma coluna por status.
 * Arrastar um cartão para outra coluna muda o status (mesmas regras de registro automático da lista).
 * Com `selectable` (modo de seleção para exportar), o clique marca/desmarca e o arraste fica desligado.
 */
export default function ActivityBoard({ activities, onOpen, onQuickStatus, onMove, busyId, selectable = false, selected, onSelect }) {
  const [dragging, setDragging] = useState(null); // { id, status }
  const [overColumn, setOverColumn] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const byStatus = Object.fromEntries(COLUMNS.map((s) => [s, []]));
  for (const a of activities) byStatus[a.status]?.push(a);

  const activate = (a) => (selectable ? onSelect([a.id], !selected.has(a.id)) : onOpen(a));

  function endDrag() {
    setDragging(null);
    setOverColumn(null);
  }

  function drop(status) {
    const item = dragging && activities.find((a) => a.id === dragging.id);
    endDrag();
    if (item && item.status !== status) onMove(item, status);
  }

  return (
    <div className={`board${dragging ? ' is-dragging' : ''}`}>
      {COLUMNS.map((status) => {
        const items = byStatus[status];
        const limited = CLOSED.has(status) && !expanded.has(status) && items.length > CLOSED_LIMIT;
        const visible = limited ? items.slice(0, CLOSED_LIMIT) : items;
        const canDrop = dragging && dragging.status !== status;

        return (
          <section
            key={status}
            className={`board-column board-column-${status.toLowerCase()}${canDrop && overColumn === status ? ' is-over' : ''}`}
            aria-label={STATUS[status].label}
            onDragOver={(e) => {
              if (!canDrop) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overColumn !== status) setOverColumn(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverColumn((c) => (c === status ? null : c));
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(status);
            }}
          >
            <header className="board-column-head">
              <span className="board-dot" aria-hidden="true" />
              <h3>{STATUS[status].label}</h3>
              <span className="board-count">{items.length}</span>
            </header>

            <div className="board-cards">
              {visible.map((a) => {
                const action = QUICK_ACTION[a.status];
                const sub = activitySubtitle(a);
                const isSelected = selectable && selected.has(a.id);
                const className = [
                  'board-card',
                  a.isOverdue && 'is-overdue',
                  isSelected && 'is-selected',
                  dragging?.id === a.id && 'is-ghost',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <article
                    key={a.id}
                    className={className}
                    tabIndex={0}
                    draggable={!selectable && busyId !== a.id}
                    aria-selected={selectable ? isSelected : undefined}
                    onClick={() => activate(a)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || (selectable && e.key === ' ')) {
                        e.preventDefault();
                        activate(a);
                      }
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(a.id));
                      setDragging({ id: a.id, status: a.status });
                    }}
                    onDragEnd={endDrag}
                  >
                    <div className="board-card-top">
                      {selectable && (
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${a.title}`}
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onSelect([a.id], e.target.checked)}
                        />
                      )}
                      <span className="board-card-title">{a.title}</span>
                    </div>
                    {sub && <div className={`cell-sub${a.type === 'CONTACT' ? ' cell-sub-contact' : ''}`}>{sub}</div>}

                    <div className="board-card-meta">
                      <ImportanceBadge value={a.importance} />
                      {a.dueDate && (
                        <span className={a.isOverdue ? 'text-danger' : 'muted'} title="Prazo">
                          {formatDateKey(a.dueDate)}
                        </span>
                      )}
                      {a.isOverdue && <Badge tone="danger">Atrasada</Badge>}
                    </div>

                    {(a.lastExecutionDate || (action && !selectable)) && (
                      <div className="board-card-foot">
                        <span className="muted">
                          {a.lastExecutionDate ? `Último registro ${formatDateKey(a.lastExecutionDate)}` : ''}
                        </span>
                        {action && !selectable && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busyId === a.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickStatus(a, action.status);
                            }}
                          >
                            {action.label}
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {items.length === 0 && <p className="board-empty">{canDrop ? 'Solte aqui' : 'Nenhum item'}</p>}

              {CLOSED.has(status) && items.length > CLOSED_LIMIT && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost board-more"
                  onClick={() =>
                    setExpanded((cur) => {
                      const next = new Set(cur);
                      if (next.has(status)) next.delete(status);
                      else next.add(status);
                      return next;
                    })
                  }
                >
                  {limited ? `Mostrar mais ${items.length - CLOSED_LIMIT}` : 'Mostrar menos'}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
