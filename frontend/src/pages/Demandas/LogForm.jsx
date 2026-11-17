import { useState } from 'react';
import { todayKey } from '../../utils/date.js';

// Registro rápido de execução. Opcionalmente conclui a demanda no mesmo passo.
export default function LogForm({ onSubmit, disabled, hint }) {
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [date, setDate] = useState(todayKey);
  const [complete, setComplete] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await onSubmit(
      { description, timeSpent: timeSpent ? Number(timeSpent) : null, executionDate: date },
      complete,
    );
    if (ok) {
      setDescription('');
      setTimeSpent('');
      setComplete(false);
    }
  }

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      <textarea
        className="textarea"
        rows={2}
        required
        maxLength={2000}
        placeholder="O que foi feito?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Descrição da execução"
      />
      <div className="log-form-row">
        <input
          className="input"
          type="date"
          required
          max={todayKey()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data da execução"
        />
        <input
          className="input"
          type="number"
          min={1}
          max={1440}
          placeholder="Minutos"
          value={timeSpent}
          onChange={(e) => setTimeSpent(e.target.value)}
          aria-label="Tempo gasto em minutos (opcional)"
        />
        <label className="checkbox">
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
          Concluir demanda
        </label>
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          Registrar
        </button>
      </div>
      {hint && <p className="log-form-hint">{hint}</p>}
    </form>
  );
}
