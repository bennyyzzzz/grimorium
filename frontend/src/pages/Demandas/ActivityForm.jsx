import { useState } from 'react';
import { CHANNEL, IMPORTANCE, toOptions } from '../../constants/activity.js';

const IMPORTANCE_OPTIONS = toOptions(IMPORTANCE);
const CHANNEL_OPTIONS = toOptions(CHANNEL);

function initialValues(activity) {
  return {
    title: activity?.title ?? '',
    description: activity?.description ?? '',
    category: activity?.category ?? '',
    importance: activity?.importance ?? 'MEDIUM',
    dueDate: activity?.dueDate ?? '',
    contactName: activity?.contactName ?? '',
    channel: activity?.channel ?? 'OTHER',
  };
}

// Cadastro/edição de demanda. Também edita contatos (exibindo canal e "com quem").
export default function ActivityForm({ activity, categories, onSubmit, onCancel }) {
  const isContact = activity?.type === 'CONTACT';
  const [values, setValues] = useState(() => initialValues(activity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: values.title,
        description: values.description || null,
        category: values.category || null,
        importance: values.importance,
        dueDate: values.dueDate || null,
        ...(isContact && { contactName: values.contactName || null, channel: values.channel }),
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Título</span>
        <input className="input" autoFocus required maxLength={200} value={values.title} onChange={set('title')} />
      </label>

      {isContact && (
        <div className="form-row">
          <label className="field">
            <span>Canal</span>
            <select className="select" value={values.channel} onChange={set('channel')}>
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Com quem <small>opcional</small>
            </span>
            <input className="input" maxLength={120} value={values.contactName} onChange={set('contactName')} />
          </label>
        </div>
      )}

      <label className="field">
        <span>
          Descrição <small>opcional</small>
        </span>
        <textarea className="textarea" rows={3} value={values.description} onChange={set('description')} />
      </label>

      <div className="form-row">
        <label className="field">
          <span>
            Categoria <small>opcional</small>
          </span>
          <input
            className="input"
            list="category-options"
            maxLength={60}
            value={values.category}
            onChange={set('category')}
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>
            Prazo <small>opcional</small>
          </span>
          <input className="input" type="date" value={values.dueDate} onChange={set('dueDate')} />
        </label>
      </div>

      <fieldset className="field">
        <legend>Prioridade</legend>
        <div className="segmented">
          {IMPORTANCE_OPTIONS.map((o) => (
            <label key={o.value} className={`segmented-option${values.importance === o.value ? ' active' : ''}`}>
              <input
                type="radio"
                name="importance"
                value={o.value}
                checked={values.importance === o.value}
                onChange={set('importance')}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : activity ? 'Salvar alterações' : 'Cadastrar demanda'}
        </button>
      </div>
    </form>
  );
}
