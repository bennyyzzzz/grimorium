import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader.jsx';
import StatCard from '../../components/StatCard/StatCard.jsx';
import Summoning from '../../components/Summoning/Summoning.jsx';
import { LORE } from '../../constants/lore.js';
import BarList from '../../components/charts/BarList.jsx';
import ColumnChart from '../../components/charts/ColumnChart.jsx';
import { IMPORTANCE } from '../../constants/activity.js';
import { dashboardService } from '../../services/dashboard.js';
import {
  formatDateKey,
  formatMinutes,
  formatShortDateKey,
  formatWeekdayDateKey,
  todayKey,
} from '../../utils/date.js';
import PeriodFilter, { PRESETS, presetRange } from './PeriodFilter.jsx';
import './Dashboard.css';

const MAX_CATEGORIES = 6;

function periodLabel({ from, to }) {
  if (from === to) return from === todayKey() ? 'Hoje' : formatDateKey(from);
  return `${formatDateKey(from)} a ${formatDateKey(to)}`;
}

const plural = (n, one, many) => (n === 1 ? one : many);

// Mantém as N maiores categorias e agrupa o restante em "Outras".
function topCategories(byCategory) {
  if (byCategory.length <= MAX_CATEGORIES) return byCategory;
  const head = byCategory.slice(0, MAX_CATEGORIES - 1);
  const rest = byCategory.slice(MAX_CATEGORIES - 1).reduce((sum, c) => sum + c.count, 0);
  return [...head, { category: 'Outras', count: rest }];
}

// O período fica na URL (?periodo=7d ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD) para favoritar e voltar.
function periodFromParams(params) {
  const from = params.get('de');
  const to = params.get('ate');
  if (from && to && from <= to) return { preset: 'custom', range: { from, to } };
  const preset = PRESETS.some((p) => p.id === params.get('periodo')) ? params.get('periodo') : 'today';
  return { preset: preset === 'custom' ? 'today' : preset, range: presetRange(preset) };
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [{ preset, range }, setPeriod] = useState(() => periodFromParams(searchParams));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardService
      .get(range)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range]);

  function handlePeriodChange({ preset: nextPreset, range: nextRange }) {
    setPeriod((current) => ({
      preset: nextPreset,
      // Mantém a mesma referência quando as datas não mudam, evitando nova requisição.
      range:
        current.range.from === nextRange.from && current.range.to === nextRange.to ? current.range : nextRange,
    }));
    setSearchParams(
      nextPreset === 'custom' ? { de: nextRange.from, ate: nextRange.to } : nextPreset === 'today' ? {} : { periodo: nextPreset },
      { replace: true },
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Produtividade com base nos registros reais de execução"
        actions={<PeriodFilter preset={preset} range={range} onChange={handlePeriodChange} />}
      />

      {error && <p className="form-error dashboard-error">{error}</p>}
      {!data && loading && <Summoning text={LORE.loadingDashboard} />}
      {data && <DashboardContent data={data} loading={loading} />}
    </>
  );
}

function DashboardContent({ data, loading }) {
  const { executed, current, period } = data;
  const isSingleDay = period.days === 1;
  const hasExecutions = executed.activities > 0;

  const importanceItems = Object.entries(IMPORTANCE).map(([key, { label }]) => ({
    label,
    value: executed.byImportance[key],
  }));
  const categoryItems = topCategories(executed.byCategory).map((c) => ({ label: c.category, value: c.count }));

  return (
    <div className={`dashboard${loading ? ' is-loading' : ''}`}>
      <section className="dashboard-section">
        <h2 className="section-title">
          Executado no período <span className="muted">· {periodLabel(period)}</span>
        </h2>
        <div className="stat-grid">
          <StatCard
            label={isSingleDay ? 'Atividades executadas no dia' : 'Atividades executadas'}
            value={executed.activities}
            hint={`${executed.byType.TASK} ${plural(executed.byType.TASK, 'demanda', 'demandas')} · ${executed.byType.CONTACT} ${plural(executed.byType.CONTACT, 'contato', 'contatos')}`}
          />
          <StatCard
            label="Concluídas"
            value={executed.completed}
            hint={plural(executed.completed, 'demanda ou contato encerrado', 'demandas e contatos encerrados')}
          />
          <StatCard
            label="Tempo registrado"
            value={formatMinutes(executed.minutes) ?? '—'}
            hint={`${executed.logs} ${plural(executed.logs, 'registro de execução', 'registros de execução')}`}
          />
          {!isSingleDay && (
            <StatCard
              label="Média por dia"
              value={(executed.activityDays / period.days).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              hint={`${executed.activityDays} execuções diárias em ${period.days} dias`}
            />
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">
          Situação atual <span className="muted">· independe do período</span>
        </h2>
        <div className="stat-grid">
          <StatCard label="Pendentes" value={current.pending} hint="Ver na lista" to="/demandas?status=PENDING" />
          <StatCard
            label="Em andamento"
            value={current.inProgress}
            hint="Ver na lista"
            to="/demandas?status=IN_PROGRESS"
          />
          <StatCard
            label="Atrasadas"
            value={current.overdue}
            tone={current.overdue > 0 ? 'danger' : undefined}
            hint={current.overdue > 0 ? 'Prazo vencido — ver na lista' : 'Nenhuma com prazo vencido'}
            to="/demandas?due=overdue"
          />
        </div>
      </section>

      {!isSingleDay && (
        <section className="chart-card">
          <header className="chart-card-header">
            <h3>Atividades executadas por dia</h3>
            <span className="muted">Cada atividade conta uma vez por dia em que recebeu registro</span>
          </header>
          <ColumnChart
            data={executed.daily.map((d) => ({ label: d.date, value: d.count }))}
            formatLabel={formatShortDateKey}
            formatTooltipLabel={formatWeekdayDateKey}
            valueLabel={(n) => plural(n, 'atividade', 'atividades')}
            caption="Atividades executadas por dia"
          />
        </section>
      )}

      <div className="chart-grid">
        <section className="chart-card">
          <header className="chart-card-header">
            <h3>Executadas por prioridade</h3>
          </header>
          {hasExecutions ? (
            <BarList items={importanceItems} total={executed.activities} ariaLabel="Atividades executadas por prioridade" />
          ) : (
            <p className="chart-empty">Nenhuma execução registrada no período.</p>
          )}
        </section>

        <section className="chart-card">
          <header className="chart-card-header">
            <h3>Executadas por categoria</h3>
          </header>
          {hasExecutions ? (
            <BarList items={categoryItems} total={executed.activities} ariaLabel="Atividades executadas por categoria" />
          ) : (
            <p className="chart-empty">Nenhuma execução registrada no período.</p>
          )}
        </section>
      </div>
    </div>
  );
}
