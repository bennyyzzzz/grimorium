import { DUE_FILTERS, IMPORTANCE, STATUS, toOptions } from '../../constants/activity.js';
import { LIST_PERIODS } from './activityView.js';

const TYPE_OPTIONS = [
  { value: 'TASK', label: 'Demandas' },
  { value: 'CONTACT', label: 'Contatos' },
];
const STATUS_OPTIONS = toOptions(STATUS);
const IMPORTANCE_OPTIONS = toOptions(IMPORTANCE);

function FilterSelect({ label, value, options, onChange }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function ActivityFilters({ filters, categories, onChange, onClear }) {
  const set = (field) => (value) => onChange({ ...filters, [field]: value });
  // O período é uma escolha à parte: "Limpar filtros" não o altera.
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'period' && value);

  return (
    <div className="filters">
      <div className="filters-period">
        <div className="segmented" role="radiogroup" aria-label="Período">
          {LIST_PERIODS.map((p) => (
            <label key={p.label} className={`segmented-option${filters.period === p.value ? ' active' : ''}`}>
              <input
                type="radio"
                name="demandas-period"
                checked={filters.period === p.value}
                onChange={() => set('period')(p.value)}
              />
              {p.label}
            </label>
          ))}
        </div>
        {filters.period && (
          <span className="filters-period-hint">
            Em aberto sempre aparecem; concluídas, canceladas e contatos só se tiveram movimento no período.
          </span>
        )}
      </div>
      <input
        type="search"
        className="input filters-search"
        placeholder="Pesquisar por título, descrição ou contato"
        value={filters.search}
        onChange={(e) => set('search')(e.target.value)}
      />
      <FilterSelect label="Demandas e contatos" value={filters.type} options={TYPE_OPTIONS} onChange={set('type')} />
      <FilterSelect label="Todos os status" value={filters.status} options={STATUS_OPTIONS} onChange={set('status')} />
      <FilterSelect
        label="Todas as prioridades"
        value={filters.importance}
        options={IMPORTANCE_OPTIONS}
        onChange={set('importance')}
      />
      <FilterSelect
        label="Todas as categorias"
        value={filters.category}
        options={categories.map((c) => ({ value: c, label: c }))}
        onChange={set('category')}
      />
      <FilterSelect label="Qualquer prazo" value={filters.due} options={DUE_FILTERS} onChange={set('due')} />
      {hasFilters && (
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
