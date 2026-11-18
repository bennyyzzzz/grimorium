import { useEffect, useState } from 'react';
import { transferService } from '../../services/transfer.js';
import { LORE } from '../../constants/lore.js';
import { addDaysKey, formatDateKey, todayKey } from '../../utils/date.js';

const FORMATS = [
  {
    value: 'json',
    label: 'Backup completo (JSON)',
    hint: 'Atividades com todo o histórico de execução. Use para importar em outra conta.',
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

export default function TransferPanel({ filters, filteredCount, selectedIds, onStartSelection, onImported }) {
  const hasFilters = Object.values(filters).some(Boolean);
  const hasSelection = selectedIds.length > 0;

  // ---------- Exportar ----------
  const [format, setFormat] = useState('json');
  const [scope, setScope] = useState(hasSelection ? 'selection' : 'period');
  const [preset, setPreset] = useState('30d');
  const [custom, setCustom] = useState({ from: addDaysKey(todayKey(), -29), to: todayKey() });
  const [applyFilters, setApplyFilters] = useState(false);
  const [preview, setPreview] = useState(null);

  const range = presetRange(preset, custom);
  const rangeInvalid = scope === 'period' && range === undefined;

  const params =
    scope === 'selection' ? { ids: selectedIds } : { ...(applyFilters ? filters : {}), ...(range ?? {}) };
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

  const empty = preview && !preview.error && preview.activities === 0;
  const canDownload = !rangeInvalid && !empty;

  function previewText() {
    if (rangeInvalid) return 'Informe um período válido.';
    if (!preview) return 'Calculando…';
    if (preview.error) return 'Não foi possível calcular a prévia.';
    if (empty) return 'Nada para exportar neste recorte.';
    if (format === 'csv-logs') return `Serão exportados ${plural(preview.logsInPeriod, 'registro', 'registros')}.`;
    if (format === 'csv') return `Serão exportadas ${plural(preview.activities, 'atividade', 'atividades')}.`;
    return `Serão exportadas ${plural(preview.activities, 'atividade', 'atividades')} com ${plural(
      preview.logs,
      'registro',
      'registros',
    )} de histórico.`;
  }

  // ---------- Importar ----------
  const [file, setFile] = useState(null); // { name, data, count }
  const [fileError, setFileError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const selected = e.target.files[0];
    setFile(null);
    setFileError(null);
    setResult(null);
    if (!selected) return;
    try {
      const data = JSON.parse(await selected.text());
      if (!Array.isArray(data?.activities)) throw new Error('formato');
      setFile({ name: selected.name, data, count: data.activities.length });
    } catch {
      setFileError('Arquivo inválido. Selecione um backup JSON exportado pelo Grimorium.');
    }
  }

  async function handleImport() {
    setImporting(true);
    setFileError(null);
    try {
      const summary = await transferService.importBackup(file.data);
      setResult(summary);
      setFile(null);
      if (summary.created > 0) onImported();
    } catch (err) {
      setFileError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="transfer">
      <section className="transfer-section">
        <h3>Exportar</h3>

        <fieldset className="field">
          <legend>O que exportar</legend>
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
          Aceita o JSON gerado em “Backup completo”. Itens que já existem aqui são ignorados, então importar o mesmo
          arquivo de novo não duplica nada.
        </p>

        <input className="input" type="file" accept=".json,application/json" onChange={handleFile} />

        {file && (
          <div className="transfer-ready">
            <span>
              <strong>{file.name}</strong> · {plural(file.count, 'atividade', 'atividades')}
            </span>
            <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? LORE.importing : 'Importar'}
            </button>
          </div>
        )}

        {fileError && <p className="form-error">{fileError}</p>}

        {result && (
          <div className="transfer-result" role="status">
            <p>
              <strong>{result.created}</strong> {result.created === 1 ? 'importada' : 'importadas'} ·{' '}
              <strong>{result.skipped}</strong> já {result.skipped === 1 ? 'existia' : 'existiam'} ·{' '}
              <strong className={result.errors.length ? 'text-danger' : undefined}>{result.errors.length}</strong> com
              erro
            </p>
            {result.errors.length > 0 && (
              <ul className="transfer-errors">
                {result.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                  <li key={e.index}>
                    Item {e.index + 1}
                    {e.title ? ` (“${e.title}”)` : ''}: {e.message}
                  </li>
                ))}
                {result.errors.length > MAX_ERRORS_SHOWN && (
                  <li>e mais {result.errors.length - MAX_ERRORS_SHOWN}…</li>
                )}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
