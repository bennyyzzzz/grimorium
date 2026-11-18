import { useState } from 'react';
import { CHANNEL, IMPORTANCE, toOptions } from '../../constants/activity.js';
import { LORE } from '../../constants/lore.js';
import { todayKey } from '../../utils/date.js';

const CHANNEL_OPTIONS = toOptions(CHANNEL);
const IMPORTANCE_OPTIONS = toOptions(IMPORTANCE);

// Registro rápido de um contato (chat, WhatsApp, ligação...). Já entra como trabalho executado no dia.
export default function ContactForm({ categories, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    title: '',
    contactName: '',
    channel: 'WHATSAPP',
    summary: '',
    category: '',
    importance: 'MEDIUM',
    date: todayKey(),
    timeSpent: '',
    followUp: false,
    dueDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) =>
    setValues((v) => ({ ...v, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...values,
        contactName: values.contactName || null,
        summary: values.summary || null,
        category: values.category || null,
        timeSpent: values.timeSpent ? Number(values.timeSpent) : null,
        dueDate: values.followUp && values.dueDate ? values.dueDate : null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <fieldset className="field">
        <legend>Canal</legend>
        <div className="chip-group">
          {CHANNEL_OPTIONS.map((o) => (
            <label key={o.value} className={`chip${values.channel === o.value ? ' active' : ''}`}>
              <input type="radio" name="channel" value={o.value} checked={values.channel === o.value} onChange={set('channel')} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-row">
        <label className="field">
          <span>Assunto</span>
          <input className="input" autoFocus required maxLength={200} value={values.title} onChange={set('title')} />
        </label>
        <label className="field">
          <span>
            Com quem <small>opcional</small>
          </span>
          <input
            className="input"
            maxLength={120}
            placeholder="Pessoa, cliente ou equipe"
            value={values.contactName}
            onChange={set('contactName')}
          />
        </label>
      </div>

      <label className="field">
        <span>
          O que foi tratado <small>opcional</small>
        </span>
        <textarea className="textarea" rows={3} maxLength={2000} value={values.summary} onChange={set('summary')} />
      </label>

      <div className="form-row form-row-3">
        <label className="field">
          <span>Data</span>
          <input className="input" type="date" required max={todayKey()} value={values.date} onChange={set('date')} />
        </label>
        <label className="field">
          <span>
            Minutos <small>opcional</small>
          </span>
          <input className="input" type="number" min={1} max={1440} value={values.timeSpent} onChange={set('timeSpent')} />
        </label>
        <label className="field">
          <span>
            Categoria <small>opcional</small>
          </span>
          <input className="input" list="contact-category-options" placeholder="Escolha ou crie" maxLength={60} value={values.category} onChange={set('category')} />
          <datalist id="contact-category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      <fieldset className="field">
        <legend>Prioridade</legend>
        <div className="segmented">
          {IMPORTANCE_OPTIONS.map((o) => (
            <label key={o.value} className={`segmented-option${values.importance === o.value ? ' active' : ''}`}>
              <input
                type="radio"
                name="contact-importance"
                value={o.value}
                checked={values.importance === o.value}
                onChange={set('importance')}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="follow-up">
        <label className="checkbox">
          <input type="checkbox" checked={values.followUp} onChange={set('followUp')} />
          Requer retorno
        </label>
        {values.followUp && (
          <label className="field follow-up-due">
            <span>
              Retornar até <small>opcional</small>
            </span>
            <input className="input" type="date" value={values.dueDate} onChange={set('dueDate')} />
          </label>
        )}
        <p className="follow-up-hint">
          {values.followUp
            ? 'O contato ficará em andamento até você concluí-lo.'
            : 'O contato será registrado como concluído.'}
        </p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? LORE.saving : 'Registrar contato'}
        </button>
      </div>
    </form>
  );
}
