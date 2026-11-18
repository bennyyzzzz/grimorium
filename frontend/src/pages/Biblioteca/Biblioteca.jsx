import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/EmptyState/EmptyState.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import GithubImportForm from './GithubImportForm.jsx';
import { ENTRY_KIND } from '../../constants/library.js';
import { LORE } from '../../constants/lore.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { libraryService } from '../../services/library.js';
import { formatDate } from '../../utils/date.js';
import './Biblioteca.css';

const MAX_TAGS_SHOWN = 14;

// Filtros ficam na URL (?q=&tipo=&tag=): voltar de uma entrada restaura a busca.
export default function Biblioteca() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('tipo') ?? '';
  const tag = params.get('tag') ?? '';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [entries, setEntries] = useState(null);
  const [tags, setTags] = useState([]);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  function setParam(key, value) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    setParam('q', debouncedSearch);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    libraryService
      .list({ search: debouncedSearch, kind, tag })
      .then((data) => {
        if (!active) return;
        setEntries(data);
        setError(null);
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [debouncedSearch, kind, tag]);

  useEffect(() => {
    libraryService.tags().then(setTags).catch(() => {});
  }, []);

  const hasFilters = Boolean(debouncedSearch || kind || tag);
  const visibleTags = tags.slice(0, MAX_TAGS_SHOWN);
  if (tag && !visibleTags.some((t) => t.tag === tag)) visibleTags.push({ tag, count: 0 });

  return (
    <>
      <PageHeader
        title="Biblioteca"
        subtitle="Passo a passo, testes, código e anotações para consultar e compartilhar"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setImporting(true)}>
              Importar do GitHub
            </button>
            <Link to="/biblioteca/nova" className="btn btn-primary">
              Nova entrada
            </Link>
          </>
        }
      />

      <div className="library-filters">
        <input
          type="search"
          className="input"
          placeholder="Pesquisar no título, conteúdo ou tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chip-group" role="group" aria-label="Tipo">
          <button type="button" className={`chip${!kind ? ' active' : ''}`} onClick={() => setParam('tipo', '')}>
            Todos
          </button>
          {Object.entries(ENTRY_KIND).map(([value, { label }]) => (
            <button
              key={value}
              type="button"
              className={`chip${kind === value ? ' active' : ''}`}
              aria-pressed={kind === value}
              onClick={() => setParam('tipo', kind === value ? '' : value)}
            >
              {label}
            </button>
          ))}
        </div>
        {visibleTags.length > 0 && (
          <div className="library-tags" role="group" aria-label="Tags">
            {visibleTags.map((t) => (
              <button
                key={t.tag}
                type="button"
                className={`tag${tag === t.tag ? ' active' : ''}`}
                aria-pressed={tag === t.tag}
                onClick={() => setParam('tag', tag === t.tag ? '' : t.tag)}
              >
                #{t.tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="form-error page-error">{error}</p>}

      {!entries && !error && <Summoning text={LORE.loadingLibrary} />}

      {entries && entries.length === 0 && (
        hasFilters ? (
          <EmptyState title={LORE.nothingFound}>Ajuste a pesquisa ou os filtros.</EmptyState>
        ) : (
          <EmptyState title={LORE.emptyLibrary}>
            Guarde aqui passo a passo, testes, código e anotações. Comece por{' '}
            <strong>Nova entrada</strong>.
          </EmptyState>
        )
      )}

      {entries && entries.length > 0 && (
        <div className="entry-grid">
          {entries.map((entry) => (
            <Link key={entry.id} to={`/biblioteca/${entry.id}`} className="entry-card">
              <div className="entry-card-head">
                <span className="entry-kind">{ENTRY_KIND[entry.kind]?.label}</span>
                {entry.pinned && (
                  <span className="entry-pinned" title="Fixada">
                    Fixada
                  </span>
                )}
              </div>
              <h2 className="entry-card-title">{entry.title}</h2>
              {entry.excerpt && <p className="entry-card-excerpt">{entry.excerpt}</p>}
              {entry.tags.length > 0 && (
                <div className="entry-card-tags">
                  {entry.tags.map((t) => (
                    <span key={t} className="tag tag-static">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="entry-card-foot">
                <span>
                  {entry.sourceUrl && <span className="entry-source-badge">GitHub</span>}
                  Atualizada em {formatDate(entry.updatedAt)}
                </span>
                {entry.attachmentsCount > 0 && (
                  <span>
                    {entry.attachmentsCount} {entry.attachmentsCount === 1 ? 'anexo' : 'anexos'}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {importing && (
        <Modal title="Importar do GitHub" onClose={() => setImporting(false)}>
          <GithubImportForm onCancel={() => setImporting(false)} />
        </Modal>
      )}
    </>
  );
}
