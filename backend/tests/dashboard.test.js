// Confere os indicadores do dashboard contra os registros gravados no banco.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, clearDatabase } from './helpers/db.js';

const activities = await import('../src/services/activity.service.js');
const { getDashboard } = await import('../src/services/dashboard.service.js');

const MON = '2026-01-05';
const TUE = '2026-01-06';
const WED = '2026-01-07';

beforeEach(clearDatabase);
after(() => prisma.$disconnect());

// Cenário: A (alta) seg+qua; B (média) seg com 2 registros; C contato (baixa) ter; D pendente sem registro.
async function seed() {
  const a = await activities.createActivity({ title: 'A', importance: 'HIGH', category: 'Financeiro' });
  await activities.changeStatus(a.id, 'IN_PROGRESS', { date: MON });
  await activities.addLog(a.id, { description: 'continuei', executionDate: WED, timeSpent: 60 });
  await activities.changeStatus(a.id, 'COMPLETED', { date: WED });

  const b = await activities.createActivity({ title: 'B', importance: 'MEDIUM', category: 'Financeiro' });
  await activities.addLog(b.id, { description: 'manhã', executionDate: MON, timeSpent: 30 });
  await activities.addLog(b.id, { description: 'tarde', executionDate: MON, timeSpent: 15 });

  await activities.createContact({ title: 'C', importance: 'LOW', channel: 'CALL', date: TUE, timeSpent: 10 });

  await activities.createActivity({ title: 'D', importance: 'HIGH', dueDate: '2020-01-01' });
}

test('um dia: conta atividades distintas com registro naquele dia', async () => {
  await seed();
  const mon = await getDashboard({ from: MON, to: MON });

  assert.equal(mon.executed.activities, 2); // A e B (B tem 2 registros, conta 1)
  assert.equal(mon.executed.logs, 3);
  assert.equal(mon.executed.minutes, 45);
  assert.deepEqual(mon.executed.byImportance, { HIGH: 1, MEDIUM: 1, LOW: 0 });

  const tue = await getDashboard({ from: TUE, to: TUE });
  assert.equal(tue.executed.activities, 1); // só o contato C; A ficou aberta mas sem trabalho
  assert.deepEqual(tue.executed.byType, { TASK: 0, CONTACT: 1 });
});

test('período: atividades distintas no total e uma vez por dia na série diária', async () => {
  await seed();
  const week = await getDashboard({ from: MON, to: WED });

  assert.equal(week.executed.activities, 3); // A, B, C — D nunca entra
  assert.equal(week.executed.activityDays, 4); // A(seg) + B(seg) + C(ter) + A(qua)
  assert.deepEqual(
    week.executed.daily,
    [
      { date: MON, count: 2 },
      { date: TUE, count: 1 },
      { date: WED, count: 1 },
    ],
  );
  assert.deepEqual(week.executed.byImportance, { HIGH: 1, MEDIUM: 1, LOW: 1 });
  assert.deepEqual(week.executed.byCategory, [
    { category: 'Financeiro', count: 2 },
    { category: 'Sem categoria', count: 1 },
  ]);
  assert.equal(week.executed.completed, 2); // A (qua) e contato C (ter)
});

test('situação atual: pendentes, em andamento e atrasadas', async () => {
  await seed();
  const { current } = await getDashboard({ from: MON, to: MON });
  assert.deepEqual(current, { pending: 1, inProgress: 1, overdue: 1 }); // D pendente+atrasada, B em andamento
});

test('período sem registros zera a produtividade', async () => {
  await seed();
  const empty = await getDashboard({ from: '2025-01-01', to: '2025-01-03' });
  assert.equal(empty.executed.activities, 0);
  assert.equal(empty.executed.daily.length, 3);
  assert.ok(empty.executed.daily.every((d) => d.count === 0));
});
