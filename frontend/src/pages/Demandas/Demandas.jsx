import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/EmptyState/EmptyState.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import { activityService } from '../../services/activities.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import ActivityFilters from './ActivityFilters.jsx';
import ActivityTable from './ActivityTable.jsx';
import ActivityForm from './ActivityForm.jsx';
import ActivityDetail from './ActivityDetail.jsx';
import ContactForm from './ContactForm.jsx';
import './Demandas.css';

const INITIAL_FILTERS = { search: '', type: '', status: '', importance: '', category: '', due: '' };

// Permite abrir a lista já filtrada, ex.: /demandas?status=PENDING (atalhos do Dashboard).
function filtersFromParams(params) {
  const filters = { ...INITIAL_FILTERS };
  for (const key of Object.keys(filters)) filters[key] = params.get(key) ?? '';
  return filters;
}

export default function Demandas() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // null | { type: 'create' } | { type: 'contact' } | { type: 'edit', activity } | { type: 'detail', id, title }
  const [modal, setModal] = useState(null);

  const search = useDebouncedValue(filters.search.trim(), 300);
  const { type, status, importance, category, due } = filters;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    activityService
      .list({ search, type, status, importance, category, due })
      .then((data) => {
        if (!active) return;
        setActivities(data);
        setError(null);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, type, status, importance, category, due, reloadKey]);

  useEffect(() => {
    activityService.categories().then(setCategories).catch(() => {});
  }, [reloadKey]);

  async function handleQuickStatus(activity, nextStatus) {
    setBusyId(activity.id);
    try {
      await activityService.changeStatus(activity.id, { status: nextStatus });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(data) {
    await activityService.create(data);
    setModal(null);
    reload();
  }

  async function handleCreateContact(data) {
    await activityService.createContact(data);
    setModal(null);
    reload();
  }

  async function handleUpdate(id, data) {
    const updated = await activityService.update(id, data);
    setModal({ type: 'detail', id, title: updated.title });
    reload();
  }

  const overdueCount = activities.filter((a) => a.isOverdue).length;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Demandas"
        subtitle="Demandas e contatos do dia a dia"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setModal({ type: 'contact' })}>
              Registrar contato
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
              Nova demanda
            </button>
          </>
        }
      />

      <ActivityFilters
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClear={() => setFilters(INITIAL_FILTERS)}
      />

      {error && <p className="form-error page-error">{error}</p>}

      {!loading || activities.length ? (
        activities.length ? (
          <>
            <p className="list-summary">
              {activities.length} {activities.length === 1 ? 'item' : 'itens'}
              {overdueCount > 0 && (
                <span className="text-danger">
                  {' '}
                  · {overdueCount} {overdueCount === 1 ? 'atrasada' : 'atrasadas'}
                </span>
              )}
            </p>
            <ActivityTable
              activities={activities}
              busyId={busyId}
              onOpen={(activity) => setModal({ type: 'detail', id: activity.id, title: activity.title })}
              onQuickStatus={handleQuickStatus}
            />
          </>
        ) : hasFilters ? (
          <EmptyState title="Nada encontrado">Ajuste ou limpe os filtros.</EmptyState>
        ) : (
          <EmptyState title="Nada cadastrado ainda">
            Use <strong>Nova demanda</strong> para tarefas com prazo ou <strong>Registrar contato</strong> para
            conversas rápidas do dia.
          </EmptyState>
        )
      ) : (
        <p className="muted">Carregando…</p>
      )}

      {modal?.type === 'create' && (
        <Modal title="Nova demanda" onClose={closeModal}>
          <ActivityForm categories={categories} onSubmit={handleCreate} onCancel={closeModal} />
        </Modal>
      )}

      {modal?.type === 'contact' && (
        <Modal title="Registrar contato" onClose={closeModal}>
          <ContactForm categories={categories} onSubmit={handleCreateContact} onCancel={closeModal} />
        </Modal>
      )}

      {modal?.type === 'edit' && (
        <Modal title={modal.activity.type === 'CONTACT' ? 'Editar contato' : 'Editar demanda'} onClose={closeModal}>
          <ActivityForm
            activity={modal.activity}
            categories={categories}
            onSubmit={(data) => handleUpdate(modal.activity.id, data)}
            onCancel={() => setModal({ type: 'detail', id: modal.activity.id, title: modal.activity.title })}
          />
        </Modal>
      )}

      {modal?.type === 'detail' && (
        <Modal title={modal.title} size="lg" onClose={closeModal}>
          <ActivityDetail
            activityId={modal.id}
            onChanged={reload}
            onEdit={(activity) => setModal({ type: 'edit', activity })}
            onDeleted={() => {
              setModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
