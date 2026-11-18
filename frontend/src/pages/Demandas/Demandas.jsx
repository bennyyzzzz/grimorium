import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/EmptyState/EmptyState.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import { LORE } from '../../constants/lore.js';
import { activityService } from '../../services/activities.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import ActivityFilters from './ActivityFilters.jsx';
import ActivityTable from './ActivityTable.jsx';
import ActivityForm from './ActivityForm.jsx';
import ActivityDetail from './ActivityDetail.jsx';
import ContactForm from './ContactForm.jsx';
import TransferPanel from './TransferPanel.jsx';
import './Demandas.css';

const INITIAL_FILTERS = { search: '', type: '', status: '', importance: '', category: '', due: '' };

// Permite abrir a lista já filtrada, ex.: /demandas?status=PENDING (atalhos do Dashboard).
function filtersFromParams(params) {
  const filters = { ...INITIAL_FILTERS };
  for (const key of Object.keys(filters)) filters[key] = params.get(key) ?? '';
  return filters;
}

export default function Demandas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Modo de seleção (para exportar): só nele as caixas de seleção aparecem.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  // null | { type: 'create' } | { type: 'contact' } | { type: 'transfer' } | { type: 'edit', activity } | { type: 'detail', id, title }
  const [modal, setModal] = useState(null);

  const search = useDebouncedValue(filters.search.trim(), 300);
  const { type, status, importance, category, due } = filters;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeModal = useCallback(() => setModal(null), []);

  // Link "Fazer backup" da barra lateral (/demandas?backup=1): abre o painel de exportação.
  const openBackup = searchParams.get('backup') === '1';
  useEffect(() => {
    if (!openBackup) return;
    setModal({ type: 'transfer' });
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('backup');
        return next;
      },
      { replace: true },
    );
  }, [openBackup, setSearchParams]);

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

  function startSelection() {
    setModal(null);
    setSelecting(true);
  }

  function cancelSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function handleSelect(ids, checked) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

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
            <button type="button" className="btn btn-ghost" onClick={() => setModal({ type: 'transfer' })}>
              Exportar / Importar
            </button>
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
            {selecting ? (
              <div className="selection-bar" role="region" aria-label="Seleção para exportar">
                <span>
                  {selected.size === 0 ? (
                    'Clique nos itens que deseja exportar'
                  ) : (
                    <>
                      <strong>{selected.size}</strong>{' '}
                      {selected.size === 1 ? 'item selecionado' : 'itens selecionados'}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={selected.size === 0}
                  onClick={() => setModal({ type: 'transfer' })}
                >
                  Exportar selecionados
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={cancelSelection}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="list-summary">
                <span>
                  {activities.length} {activities.length === 1 ? 'item' : 'itens'}
                  {overdueCount > 0 && (
                    <span className="text-danger">
                      {' '}
                      · {overdueCount} {overdueCount === 1 ? 'atrasada' : 'atrasadas'}
                    </span>
                  )}
                </span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={startSelection}>
                  Selecionar para exportar
                </button>
              </div>
            )}
            <ActivityTable
              activities={activities}
              selectable={selecting}
              selected={selected}
              onSelect={handleSelect}
              busyId={busyId}
              onOpen={(activity) => setModal({ type: 'detail', id: activity.id, title: activity.title })}
              onQuickStatus={handleQuickStatus}
            />
          </>
        ) : error ? null : hasFilters ? (
          <EmptyState title={LORE.nothingFound}>Ajuste ou limpe os filtros.</EmptyState>
        ) : (
          <EmptyState title={LORE.emptyGrimoire}>
            Use <strong>Nova demanda</strong> para tarefas com prazo ou <strong>Registrar contato</strong> para
            conversas rápidas do dia.
          </EmptyState>
        )
      ) : (
        <Summoning text={LORE.loadingActivities} />
      )}

      {modal?.type === 'create' && (
        <Modal title="Nova demanda" onClose={closeModal}>
          <ActivityForm categories={categories} onSubmit={handleCreate} onCancel={closeModal} />
        </Modal>
      )}

      {modal?.type === 'transfer' && (
        <Modal title="Exportar e importar" onClose={closeModal}>
          <TransferPanel
            filters={{ ...filters, search: filters.search.trim() }}
            filteredCount={activities.length}
            selectedIds={selecting ? [...selected] : []}
            onStartSelection={startSelection}
            onImported={reload}
          />
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
              handleSelect([modal.id], false);
              setModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
