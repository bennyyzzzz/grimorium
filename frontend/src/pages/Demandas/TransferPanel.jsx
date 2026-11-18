import { useEffect, useState } from 'react';
import { transferService } from '../../services/transfer.js';
import { LORE } from '../../constants/lore.js';
import { formatBytes } from '../../constants/library.js';
import { addDaysKey, formatDateKey, todayKey } from '../../utils/date.js';

const FORMATS = [
  {
    value: 'backup',
    label: 'Backup completo (.zip)',
    hint: 'Demandas, contatos e registros + Biblioteca com anexos. Use para guardar ou levar a outro computador.',
  },
  {
    value: 'csv',
    label: 'Planilha de atividades (CSV)',
    hint: 'Uma linha por demanda ou contato, com totais do período.',
  },
  {
    value: 'csv-logs',
    label: 'Planilha de registros (CSV)',
    hint: 'Uma linha por execução realizada no período.',
  },
];

const PERIOD_PRESETS = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Personalizado' },
];

const MAX_ERRORS_SHOWN = 10;

function presetRange(id, custom) {
  const today = todayKey();
  switch (id) {
    case '7d':
      return { from: addDaysKey(today, -6), to: today };
    case '30d':
      return { from: addDaysKey(today, -29), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'custom':
      return custom.from && custom.to && custom.from <= custom.to ? custom : undefined; // undefined = inválido
    default:
      return null; // tudo
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function ImportSummary({ label, result, noun }) {
  if (!result || result.total === 0) return null;
  return (
    <>
      <p>
        <strong>{label}:</strong> {result.created} {result.created === 1 ? noun[0] : noun[1]} ·{' '}
        {result.skipped} já {result.skipped === 1 ? 'existia' : 'existiam'}
        {result.attachments !== undefined && ` · ${plural(result.attachments, 'anexo restaurado', 'anexos restaurados')}`}
        {result.errors.length > 0 && <span className="text-danger"> · {result.errors.length} com erro</span>}
      </p>
      {result.errors.length > 0 && (
        <ul className="transfer-errors">
          {result.errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
            <li key={`${e.index}-${i}`}>
              Item {e.index + 1}
              {e.title ? ` (“${e.title}”)` : ''}: {e.message}
            </li>
          ))}
          {result.errors.length > MAX_ERRORS_SHOWN && <li>e mais {result.errors.length - MAX_ERRORS_SHOWN}…</li>}
        </ul>
      )}
    </>
  );
}

export default function TransferPanel({ filters, filteredCount, selectedIds, onStartSelection, onImported }) {
  const hasFilters = Object.values(filters).some(Boolean);
  const hasSelection = selectedIds.length > 0;

  // ---------- Exportar ----------
  const [format, setFormat] = useState('backup');
  const [scope, setScope] = useState(hasSelection ? 'selection' : 'period');
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState({ from: addDaysKey(todayKey(), -29), to: todayKey() });
  const [applyFilters, setApplyFilters] = useState(false);
  const [includeLibrary, setIncludeLibrary] = useState(true);
  const [preview, setPreview] = useState(null);

  const range = presetRange(preset, custom);
  const rangeInvalid = scope === 'period' && range === undefined;
  const withLibrary = format === 'backup' && includeLibrary;

  const params = {
    ...(scope === 'selection' ? { ids: selectedIds } : { ...(applyFilters ? filters : {}), ...(range ?? {}) }),
    ...(withLibrary && { library: '1' }),
  };
  // Chave estável: a prévia só é recalculada quando o recorte realmente muda.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (rangeInvalid) return undefined;
    let active = true;
    setPreview(null);
    const id = setTimeout(() => {
      transferService
        .preview(JSON.parse(paramsKey))
        .then((data) => active && setPreview(data))
        .catch(() => active && setPreview({ error: true }));
    }, 250);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [paramsKey, rangeInvalid]);

  const libraryCount = preview?.library?.entries ?? 0;
  const empty =
    preview && !preview.error && (format === 'csv-logs' ? preview.logsInPeriod === 0 : preview.activities === 0) &&
    !(withLibrary && libraryCount > 0);
  const canDownload = !rangeInvalid && !empty;

  function previewText() {
    if (rangeInvalid) return 'Informe um período válido.';
    if (!preview) return 'Calculando…';
    if (preview.error) return 'Não foi possível calcular a prévia.';
    if (empty) return 'Nada para exportar neste recorte.';
    if (format === 'csv-logs') return `Serão exportados ${plural(preview.logsInPeriod, 'registro', 'registros')}.`;
    if (format === 'csv') return `Serão exportadas ${plural(preview.activities, 'atividade', 'atividades')}.`;
    const parts = [
      `${plural(preview.activities, 'atividade', 'atividades')} (${plural(preview.logs, 'registro', 'registros')})`,
    ];
    if (withLibrary && preview.library) {
      const { entries, attachments, bytes } = preview.library;
      parts.push(
        `${plural(entries, 'entrada', 'entradas')} da Biblioteca` +
          (attachments ? ` com ${plural(attachments, 'anexo', 'anexos')} (${formatBytes(bytes)})` : ''),
      );
    }
    return `Serão exportadas ${parts.join(' + ')}.`;
  }

  // ---------- Importar ----------
  const [file, setFile] = useState(null); // { name, size, kind: 'zip' | 'json', raw?, data?, counts? }
  const [fileError, setFileError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const selected = e.target.files[0];
    setFile(null);
    setFileError(null);
    setResult(null);
    if (!selected) return;

    if (selected.name.toLowerCase().endsWith('.zip')) {
      setFile({ name: selected.name, size: selected.size, kind: 'zip', raw: selected });
      return;
    }
    try {
      const data = JSON.parse(await selected.text());
      if (!Array.isArray(data?.activities)) throw new Error('formato');
      setFile({
        name: selected.name,
        size: selected.size,
        kind: 'json',
        data,
        counts: { activities: data.activities.length, library: Array.isArray(data.library) ? data.library.length : 0 },
      });
    } catch {
      setFileError('Arquivo inválido. Selecione um backup (.zip ou .json) exportado pelo Grimorium.');
    }
  }

  async function handleImport() {
    setImporting(true);
    setFileError(null);
    try {
      const summary =
        file.kind === 'zip' ? await transferService.importZip(file.raw) : await transferService.importBackup(file.data);
      setResult(summary);
      setFile(null);
      if (summary.activities.created > 0 || summary.library.created > 0) onImported();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const nothingImported = result && result.activities.total === 0 && result.library.total === 0;

  return (
    <div className="transfer">
      <div className="local-data-warning" role="note">
        <strong>Seus dados ficam só neste computador.</strong>
        <p>
          O Grimorium não tem backup em nuvem nem servidor. Para não perder informações ou para levá-las a outra
          máquina, faça backups manuais com o <strong>Backup completo (.zip)</strong> abaixo, de preferência com o
          período <strong>Tudo</strong>, e guarde o arquivo fora deste computador.
        </p>
        <p>
          O backup inclui demandas, contatos, registros e a Biblioteca com anexos. Ele <strong>não</strong> inclui as
          chaves do <code>backend/.env</code> (Claude, GitHub), por segurança.
        </p>
      </div>

      <section className="transfer-section">
        <h3>Exportar</h3>

        <fieldset className="field">
          <legend>Demandas e contatos a exportar</legend>
          <div className="option-list">
            {hasSelection && (
              <label className={`option-card${scope === 'selection' ? ' active' : ''}`}>
                <input type="radio" name="scope" checked={scope === 'selection'} onChange={() => setScope('selection')} />
                <span>
                  <strong>Itens selecionados ({selectedIds.length})</strong>
                  <small>Exatamente as demandas e contatos marcados na lista.</small>
                </span>
              </label>
            )}
            <label className={`option-card${scope === 'period' ? ' active' : ''}`}>
              <input type="radio" name="scope" checked={scope === 'period'} onChange={() => setScope('period')} />
              <span>
                <strong>Por período</strong>
                <small>Atividades com execução ou criadas no período.</small>
              </span>
            </label>
          </div>
          {!hasSelection && (
            <button type="button" className="btn btn-sm btn-ghost transfer-pick" onClick={onStartSelection}>
              Prefere escolher itens específicos? Selecionar na lista
            </button>
          )}
        </fieldset>

        {scope === 'period' && (
          <div className="transfer-period">
            <div className="chip-group" role="group" aria-label="Período">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${preset === p.id ? ' active' : ''}`}
                  aria-pressed={preset === p.id}
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === 'custom' ? (
              <div className="period-custom">
                <input
                  className="input"
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  aria-label="Data inicial"
                />
                <span className="muted">até</span>
                <input
                  className="input"
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  aria-label="Data final"
                />
              </div>
            ) : (
              range && (
                <p className="transfer-hint muted">
                  {formatDateKey(range.from)} a {formatDateKey(range.to)}
                </p>
              )
            )}

            {hasFilters && (
              <label className="checkbox">
                <input type="checkbox" checked={applyFilters} onChange={(e) => setApplyFilters(e.target.checked)} />
                Aplicar também os filtros atuais da lista ({filteredCount} {filteredCount === 1 ? 'item' : 'itens'})
              </label>
            )}
          </div>
        )}

        <fieldset className="field">
          <legend>Formato</legend>
          <div className="option-list">
            {FORMATS.map((f) => (
              <label key={f.value} className={`option-card${format === f.value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="export-format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                />
                <span>
                  <strong>{f.label}</strong>
                  <small>{f.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {format === 'backup' && (
          <label className="checkbox transfer-library">
            <input type="checkbox" checked={includeLibrary} onChange={(e) => setIncludeLibrary(e.target.checked)} />
            <span>
              Incluir a Biblioteca <small className="muted">— vai inteira, com anexos (não usa período nem seleção)</small>
            </span>
          </label>
        )}

        <div className="transfer-footer">
          <p className={`transfer-preview${empty || rangeInvalid ? ' text-danger' : ''}`} role="status">
            {previewText()}
          </p>
          {canDownload ? (
            <a className="btn btn-primary" href={transferService.exportUrl(format, params)} download>
              Baixar arquivo
            </a>
          ) : (
            <button type="button" className="btn btn-primary" disabled>
              Baixar arquivo
            </button>
          )}
        </div>
      </section>

      <section className="transfer-section">
        <h3>Importar backup</h3>
        <p className="muted transfer-hint">
          Aceita o <strong>.zip</strong> do “Backup completo” (e também backups <strong>.json</strong> antigos). Itens que
          já existem aqui são ignorados, então importar o mesmo arquivo de novo não duplica nada.
        </p>

        <input className="input" type="file" accept=".zip,application/zip,.json,application/json" onChange={handleFile} />

        {file && (
          <div className="transfer-ready">
            <span>
              <strong>{file.name}</strong> · {formatBytes(file.size)}
              {file.counts &&
                ` · ${plural(file.counts.activities, 'atividade', 'atividades')}` +
                  (file.counts.library ? ` · ${plural(file.counts.library, 'entrada', 'entradas')} da Biblioteca` : '')}
            </span>
            <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? LORE.importing : 'Importar'}
            </button>
          </div>
        )}

        {fileError && <p className="form-error">{fileError}</p>}

        {result && (
          <div className="transfer-result" role="status">
            {nothingImported ? (
              <p>O backup estava vazio.</p>
            ) : (
              <>
                <ImportSummary label="Demandas e contatos" result={result.activities} noun={['importada', 'importadas']} />
                <ImportSummary label="Biblioteca" result={result.library} noun={['entrada importada', 'entradas importadas']} />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
