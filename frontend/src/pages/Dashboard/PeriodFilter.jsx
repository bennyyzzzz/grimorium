import { useState } from 'react';
import { addDaysKey, todayKey } from '../../utils/date.js';

export const PRESETS = [
  { id: 'today', label: 'Hoje', days: 1 },
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: 'custom', label: 'Personalizado' },
];

export function presetRange(id) {
  const today = todayKey();
  const preset = PRESETS.find((p) => p.id === id);
  return { from: addDaysKey(today, -((preset?.days ?? 1) - 1)), to: today };
}

export default function PeriodFilter({ preset, range, onChange }) {
  const [draft, setDraft] = useState(range);
  const draftValid = draft.from && draft.to && draft.from <= draft.to;

  function selectPreset(id) {
    if (id === 'custom') {
      setDraft(range);
      onChange({ preset: 'custom', range });
    } else {
      onChange({ preset: id, range: presetRange(id) });
    }
  }

  function updateDraft(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (next.from && next.to && next.from <= next.to) onChange({ preset: 'custom', range: next });
  }

  return (
    <div className="period-filter">
      <div className="segmented" role="group" aria-label="Período">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`segmented-option${preset === p.id ? ' active' : ''}`}
            aria-pressed={preset === p.id}
            onClick={() => selectPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="period-custom">
          <input
            className="input"
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => updateDraft('from', e.target.value)}
            aria-label="Data inicial"
          />
          <span className="muted">até</span>
          <input
            className="input"
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => updateDraft('to', e.target.value)}
            aria-label="Data final"
          />
          {!draftValid && <span className="text-danger period-error">Período inválido</span>}
        </div>
      )}
    </div>
  );
}
