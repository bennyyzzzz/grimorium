import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import BackLink from '../../components/BackLink/BackLink.jsx';
import Markdown from '../../components/Markdown/Markdown.jsx';
import CopyButton from '../../components/CopyButton/CopyButton.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import { ENTRY_KIND, codeFence } from '../../constants/library.js';
import { LORE } from '../../constants/lore.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { libraryService } from '../../services/library.js';
import { formatDate } from '../../utils/date.js';
import AttachmentList from './AttachmentList.jsx';
import './Biblioteca.css';

// Conteúdo pronto para colar em chat, e-mail, GitHub, Notion… (anexos ficam só citados).
function toMarkdown(entry) {
  const parts = [`# ${entry.title}`];
  if (entry.summary) parts.push(`> ${entry.summary}`);
  if (entry.content) parts.push(entry.content);
  if (entry.sourceCode !== null && entry.sourceCode !== undefined) {
    parts.push(`Fonte: [${entry.sourceLabel}](${entry.sourceUrl})\n\n${codeFence(entry.sourceCode, entry.sourceLanguage ?? '')}`);
  }
  if (entry.tags.length) parts.push(entry.tags.map((t) => `#${t}`).join(' '));
  if (entry.attachments.length) {
    parts.push(`---\nAnexos (não incluídos): ${entry.attachments.map((a) => a.originalName).join(', ')}`);
  }
  return `${parts.join('\n\n')}\n`;
}

export default function EntryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    setEntry(null);
    libraryService
      .get(id)
      .then((data) => active && setEntry(data))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [id]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function syncGithub() {
    setSyncing(true);
    setNotice(null);
    const result = await run(() => libraryService.syncGithub(entry.id));
    setSyncing(false);
    if (!result) return;
    setEntry(result.entry);
    setNotice(result.changed ? 'Código atualizado com a versão atual do GitHub.' : 'O código já estava igual ao do GitHub.');
  }

  async function togglePinned() {
    const updated = await run(() => libraryService.update(entry.id, { pinned: !entry.pinned }));
    if (updated) setEntry(updated);
  }

  async function removeEntry() {
    const confirmed = await confirm({
      title: 'Excluir entrada?',
      message: `“${entry.title}”${
        entry.attachments.length ? ` e ${entry.attachments.length} anexo(s)` : ''
      } serão removidos. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
    });
    if (!confirmed) return;
    const ok = await run(async () => {
      await libraryService.remove(entry.id);
      return true;
    });
    if (ok) navigate('/biblioteca', { replace: true });
  }

  async function removeAttachment(attachment) {
    const confirmed = await confirm({
      title: 'Excluir anexo?',
      message: `“${attachment.originalName}” será removido desta entrada.`,
      confirmLabel: 'Excluir anexo',
    });
    if (!confirmed) return;
    const updated = await run(() => libraryService.removeAttachment(entry.id, attachment.id));
    if (updated) setEntry(updated);
  }

  if (!entry) {
    return error ? (
      <div className="entry-page">
        <BackLink to="/biblioteca">Biblioteca</BackLink>
        <p className="form-error">{error}</p>
      </div>
    ) : (
      <Summoning text={LORE.openingEntry} />
    );
  }

  return (
    <article className="entry-page">
      <BackLink to="/biblioteca">Biblioteca</BackLink>

      <header className="entry-header">
        <div className="entry-header-main">
          <span className="entry-kind">{ENTRY_KIND[entry.kind]?.label}</span>
          <h1>{entry.title}</h1>
          {entry.summary && <p className="entry-summary">{entry.summary}</p>}
          <div className="entry-meta">
            {entry.tags.map((t) => (
              <Link key={t} to={`/biblioteca?tag=${encodeURIComponent(t)}`} className="tag">
                #{t}
              </Link>
            ))}
            <span className="muted">
              Criada em {formatDate(entry.createdAt)} · atualizada em {formatDate(entry.updatedAt)}
            </span>
          </div>
        </div>
        <div className="entry-actions">
          <CopyButton getText={() => toMarkdown(entry)} label="Copiar como Markdown" className="btn btn-sm" />
          <button type="button" className="btn btn-sm" onClick={togglePinned} disabled={busy}>
            {entry.pinned ? 'Desafixar' : 'Fixar'}
          </button>
          <Link to={`/biblioteca/${entry.id}/editar`} className="btn btn-sm btn-primary">
            Editar
          </Link>
        </div>
      </header>

      {notice && (
        <p className="entry-notice" role="status">
          {notice}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      {entry.sourceUrl && (
        <section className="github-source">
          <div className="github-source-info">
            <span className="entry-source-badge">GitHub</span>
            <span className="github-source-label">{entry.sourceLabel}</span>
            <span className="muted">
              Sincronizado em {new Date(entry.sourceSyncedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
          <div className="github-source-actions">
            <a className="btn btn-sm" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
              Abrir no GitHub
            </a>
            <button type="button" className="btn btn-sm" onClick={syncGithub} disabled={busy}>
              {syncing ? LORE.syncingGithub : 'Atualizar do GitHub'}
            </button>
          </div>
        </section>
      )}

      {entry.sourceUrl && (
        <div className="entry-code">
          <Markdown>{codeFence(entry.sourceCode ?? '', entry.sourceLanguage ?? '')}</Markdown>
        </div>
      )}

      {(entry.content || !entry.sourceUrl) && (
        <div className="entry-body">
          {entry.sourceUrl && <h2 className="entry-notes-title">Anotações</h2>}
          {entry.content ? <Markdown>{entry.content}</Markdown> : <p className="muted">Sem conteúdo.</p>}
        </div>
      )}

      {entry.attachments.length > 0 && (
        <section className="entry-section">
          <h2>Anexos ({entry.attachments.length})</h2>
          <AttachmentList entryId={entry.id} attachments={entry.attachments} onRemove={removeAttachment} disabled={busy} />
        </section>
      )}

      <footer className="entry-footer">
        <button type="button" className="btn btn-danger-ghost" onClick={removeEntry} disabled={busy}>
          Excluir entrada
        </button>
      </footer>
    </article>
  );
}
