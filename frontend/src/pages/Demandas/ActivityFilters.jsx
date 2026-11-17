import { DUE_FILTERS, IMPORTANCE, STATUS, toOptions } from '../../constants/activity.js';

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
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="filters">
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
