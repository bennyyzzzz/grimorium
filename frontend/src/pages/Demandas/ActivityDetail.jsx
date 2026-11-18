import { useEffect, useState } from 'react';
import Badge, { ImportanceBadge, StatusBadge } from '../../components/Badge/Badge.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import { LORE } from '../../constants/lore.js';
import { activityService } from '../../services/activities.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { CHANNEL } from '../../constants/activity.js';
import { formatDate, formatDateKey, formatMinutes } from '../../utils/date.js';
import LogForm from './LogForm.jsx';

// Ações de status disponíveis para cada status atual. A primeira é a principal.
const STATUS_ACTIONS = {
  PENDING: [
    { status: 'IN_PROGRESS', label: 'Iniciar' },
    { status: 'COMPLETED', label: 'Concluir' },
    { status: 'CANCELED', label: 'Cancelar demanda' },
  ],
  IN_PROGRESS: [
    { status: 'COMPLETED', label: 'Concluir' },
    { status: 'PENDING', label: 'Voltar para pendente' },
    { status: 'CANCELED', label: 'Cancelar demanda' },
  ],
  COMPLETED: [{ status: 'IN_PROGRESS', label: 'Reabrir' }],
  CANCELED: [{ status: 'PENDING', label: 'Reabrir' }],
};

export default function ActivityDetail({ activityId, onEdit, onChanged, onDeleted }) {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    activityService
      .get(activityId)
      .then((data) => active && setActivity(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [activityId]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      if (updated) setActivity(updated);
      onChanged();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!activity) {
    return error ? <p className="form-error">{error}</p> : <Summoning text={LORE.loadingActivity} />;
  }

  const { id, status } = activity;
  const isContact = activity.type === 'CONTACT';
  const canLog = status === 'PENDING' || status === 'IN_PROGRESS';

  const changeStatus = (next) => run(() => activityService.changeStatus(id, { status: next }));

  const addLog = (data, complete) =>
    run(async () => {
      let updated = await activityService.addLog(id, data);
      if (complete) {
        updated = await activityService.changeStatus(id, { status: 'COMPLETED', date: data.executionDate });
      }
      return updated;
    });

  async function removeLog(log) {
    const confirmed = await confirm({
      title: 'Excluir registro de execução?',
      message: `O registro de ${formatDateKey(log.executionDate)} será removido. Se for o único desse dia, a atividade deixa de contar como executada nessa data.`,
      confirmLabel: 'Excluir registro',
    });
    if (confirmed) run(() => activityService.removeLog(id, log.id));
  }

  async function removeActivity() {
    const confirmed = await confirm({
      title: isContact ? 'Excluir contato?' : 'Excluir demanda?',
      message: `“${activity.title}” e todos os seus registros de execução serão removidos. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
    });
    if (!confirmed) return;
    const ok = await run(() => activityService.remove(id));
    if (ok) onDeleted();
  }

  return (
    <div className="detail">
      <div className="detail-badges">
        {isContact && <Badge tone="neutral">Contato</Badge>}
        <StatusBadge value={status} />
        <ImportanceBadge value={activity.importance} />
        {activity.isOverdue && <Badge tone="danger">Atrasada</Badge>}
      </div>

      {activity.description && <p className="detail-description">{activity.description}</p>}

      <dl className="detail-meta">
        {isContact && (
          <>
            <div>
              <dt>Canal</dt>
              <dd>{CHANNEL[activity.channel]?.label ?? '—'}</dd>
            </div>
            <div>
              <dt>Com quem</dt>
              <dd>{activity.contactName || '—'}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Categoria</dt>
          <dd>{activity.category || '—'}</dd>
        </div>
        <div>
          <dt>{isContact ? 'Retornar até' : 'Prazo'}</dt>
          <dd className={activity.isOverdue ? 'text-danger' : undefined}>{formatDateKey(activity.dueDate)}</dd>
        </div>
        <div>
          <dt>Criada em</dt>
          <dd>{formatDate(activity.createdAt)}</dd>
        </div>
        <div>
          <dt>Início</dt>
          <dd>{formatDate(activity.startedAt)}</dd>
        </div>
        <div>
          <dt>Conclusão</dt>
          <dd>{formatDate(activity.completedAt)}</dd>
        </div>
      </dl>

      <div className="detail-actions">
        {STATUS_ACTIONS[status].map((action, index) => (
          <button
            key={action.status}
            type="button"
            className={`btn btn-sm${index === 0 ? ' btn-primary' : ''}`}
            disabled={busy}
            onClick={() => changeStatus(action.status)}
          >
            {action.label}
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      <section className="detail-section">
        <h3>Registrar execução</h3>
        {canLog ? (
          <LogForm
            onSubmit={addLog}
            disabled={busy}
            hint={status === 'PENDING' ? 'Registrar uma execução coloca a demanda em andamento.' : null}
          />
        ) : (
          <p className="muted">Reabra a demanda para registrar uma nova execução.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Histórico de execuções ({activity.logs.length})</h3>
        {activity.logs.length === 0 ? (
          <p className="muted">Nenhum trabalho registrado ainda.</p>
        ) : (
          <ul className="log-list">
            {activity.logs.map((log) => (
              <li key={log.id} className="log-item">
                <div className="log-item-head">
                  <strong>{formatDateKey(log.executionDate)}</strong>
                  {log.timeSpent && <span className="muted">{formatMinutes(log.timeSpent)}</span>}
                  <button
                    type="button"
                    className="btn-icon log-remove"
                    onClick={() => removeLog(log)}
                    disabled={busy}
                    aria-label="Excluir registro"
                    title="Excluir registro"
                  >
                    ×
                  </button>
                </div>
                {log.description && <p>{log.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="detail-footer">
        <button type="button" className="btn btn-danger-ghost" onClick={removeActivity} disabled={busy}>
          {isContact ? 'Excluir contato' : 'Excluir demanda'}
        </button>
        <button type="button" className="btn" onClick={() => onEdit(activity)} disabled={busy}>
          Editar
        </button>
      </footer>
    </div>
  );
}
