import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackLink from '../../components/BackLink/BackLink.jsx';
import Markdown from '../../components/Markdown/Markdown.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import { ENTRY_KIND, ENTRY_TEMPLATES, MAX_ATTACHMENT_SIZE, formatBytes } from '../../constants/library.js';
import { LORE } from '../../constants/lore.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { libraryService } from '../../services/library.js';
import AttachmentList from './AttachmentList.jsx';
import TagInput from './TagInput.jsx';
import './Biblioteca.css';

const EMPTY = { title: '', kind: 'HOWTO', summary: '', tags: [], content: ENTRY_TEMPLATES.HOWTO };

function valuesFrom(entry) {
  return {
    title: entry.title,
    kind: entry.kind,
    summary: entry.summary ?? '',
    tags: entry.tags,
    content: entry.content,
  };
}

export default function EntryEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [entry, setEntry] = useState(null); // entrada salva (edição)
  const [values, setValues] = useState(isNew ? EMPTY : null);
  const [initial, setInitial] = useState(isNew ? EMPTY : null);
  const [tab, setTab] = useState('write');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  useEffect(() => {
    libraryService
      .tags()
      .then((tags) => setTagSuggestions(tags.map((t) => t.tag)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let active = true;
    libraryService
      .get(id)
      .then((data) => {
        if (!active) return;
        setEntry(data);
        setValues(valuesFrom(data));
        setInitial(valuesFrom(data));
      })
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const dirty = values && (JSON.stringify(values) !== JSON.stringify(initial) || pendingFiles.length > 0);
  const set = (field) => (value) => setValues((v) => ({ ...v, [field]: value }));

  // Trocar o tipo aplica o modelo do novo tipo, mas só se o conteúdo ainda for o modelo (ou vazio).
  function changeKind(kind) {
    setValues((v) => {
      // Entradas do GitHub guardam só anotações: não recebem o modelo de estrutura.
      if (entry?.sourceUrl) return { ...v, kind };
      const untouched = !v.content.trim() || v.content === ENTRY_TEMPLATES[v.kind];
      return { ...v, kind, content: untouched ? ENTRY_TEMPLATES[kind] : v.content };
    });
  }

  function addFiles(fileList) {
    const files = [...fileList];
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_SIZE);
    if (tooBig.length) setError(`Arquivo maior que 25 MB: ${tooBig.map((f) => f.name).join(', ')}`);
    const accepted = files.filter((f) => f.size <= MAX_ATTACHMENT_SIZE);
    setPendingFiles((current) => [...current, ...accepted].slice(0, 10));
  }

  async function removeSavedAttachment(attachment) {
    const confirmed = await confirm({
      title: 'Excluir anexo?',
      message: `“${attachment.originalName}” será removido desta entrada.`,
      confirmLabel: 'Excluir anexo',
    });
    if (!confirmed) return;
    try {
      setEntry(await libraryService.removeAttachment(entry.id, attachment.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function save() {
    if (saving) return;
    if (!values.title.trim()) {
      setError('Preencha o título.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...values, summary: values.summary || null };
      const saved = isNew ? await libraryService.create(payload) : await libraryService.update(entry.id, payload);
      if (pendingFiles.length) {
        try {
          await libraryService.uploadAttachments(saved.id, pendingFiles);
        } catch (err) {
          // A entrada foi salva; segue para a edição dela mostrando o problema dos anexos.
          setPendingFiles([]);
          setInitial(valuesFrom(saved));
          setSaving(false);
          setError(`Entrada salva, mas os anexos não foram enviados: ${err.message}`);
          if (isNew) navigate(`/biblioteca/${saved.id}/editar`, { replace: true });
          return;
        }
      }
      navigate(`/biblioteca/${saved.id}`, { replace: !isNew });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function cancel() {
    if (dirty) {
      const confirmed = await confirm({
        title: 'Descartar alterações?',
        message: 'O que você escreveu desde o último salvamento será perdido.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
      });
      if (!confirmed) return;
    }
    navigate(isNew ? '/biblioteca' : `/biblioteca/${id}`);
  }

  // Ctrl/Cmd+S salva.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Tab no editor insere 2 espaços (útil para código) em vez de sair do campo.
  function handleContentKeyDown(e) {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const el = e.target;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = `${values.content.slice(0, start)}  ${values.content.slice(end)}`;
    set('content')(next);
    requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
  }

  if (!values) {
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
    <form
      className="entry-page entry-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="editor-top">
        <BackLink onClick={cancel}>{isNew ? 'Biblioteca' : 'Voltar para a entrada'}</BackLink>
        <span className="muted editor-hint">{dirty ? 'Alterações não salvas · Ctrl+S salva' : 'Ctrl+S salva'}</span>
      </div>

      <input
        className="editor-title"
        placeholder="Título da entrada"
        value={values.title}
        onChange={(e) => set('title')(e.target.value)}
        maxLength={200}
        autoFocus={isNew}
        aria-label="Título"
      />

      <div className="editor-meta">
        <fieldset className="field">
          <legend>Tipo</legend>
          <div className="segmented editor-kind">
            {Object.entries(ENTRY_KIND).map(([kind, { label }]) => (
              <label key={kind} className={`segmented-option${values.kind === kind ? ' active' : ''}`}>
                <input type="radio" name="kind" value={kind} checked={values.kind === kind} onChange={() => changeKind(kind)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <span>Tags</span>
          <TagInput value={values.tags} onChange={set('tags')} suggestions={tagSuggestions} />
        </div>

        <label className="field">
          <span>
            Resumo <small>opcional — aparece na lista</small>
          </span>
          <input
            className="input"
            maxLength={300}
            value={values.summary}
            onChange={(e) => set('summary')(e.target.value)}
          />
        </label>
      </div>

      {entry?.sourceUrl && (
        <p className="github-editor-note">
          <span className="entry-source-badge">GitHub</span>
          O código vem de <strong>{entry.sourceLabel}</strong> e é atualizado pelo botão “Atualizar do GitHub” na
          entrada. Aqui você escreve as <strong>anotações</strong> (como executar, observações…), que nunca são
          sobrescritas.
        </p>
      )}

      <div className="editor-content">
        <div className="editor-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'active' : ''} onClick={() => setTab('write')}>
            Escrever
          </button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>
            Visualizar
          </button>
          <span className="editor-tabs-hint muted">
            Markdown: <code>## título</code> <code>1. passo</code> <code>```js código```</code> <code>- [ ] tarefa</code>
          </span>
        </div>
        {tab === 'write' ? (
          <textarea
            className="editor-textarea"
            value={values.content}
            onChange={(e) => set('content')(e.target.value)}
            onKeyDown={handleContentKeyDown}
            spellCheck={false}
            aria-label="Conteúdo em Markdown"
          />
        ) : (
          <div className="editor-preview">
            {values.content.trim() ? <Markdown>{values.content}</Markdown> : <p className="muted">Nada para visualizar.</p>}
          </div>
        )}
      </div>

      <section className="entry-section">
        <h2>Anexos</h2>
        {entry?.attachments.length > 0 && (
          <AttachmentList entryId={entry.id} attachments={entry.attachments} onRemove={removeSavedAttachment} />
        )}

        {pendingFiles.length > 0 && (
          <ul className="attachment-list">
            {pendingFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="attachment attachment-pending">
                <span className="attachment-icon" aria-hidden="true">
                  NOVO
                </span>
                <div className="attachment-info">
                  <span className="attachment-name">{file.name}</span>
                  <span className="muted">{formatBytes(file.size)} · enviado ao salvar</span>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setPendingFiles((files) => files.filter((_, i) => i !== index))}
                  aria-label={`Remover ${file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <span>Arraste arquivos aqui ou</span>
          <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
            Escolher arquivos
          </button>
          <span className="muted">até 25 MB cada</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="editor-actions">
        <button type="button" className="btn" onClick={cancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? LORE.saving : isNew ? 'Salvar entrada' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
