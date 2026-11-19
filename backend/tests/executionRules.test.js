// Valida a regra fundamental: atividade cadastrada ≠ atividade executada.
// Roda em banco isolado (test.db) — ver .env.test.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, clearDatabase } from './helpers/db.js';

const activities = await import('../src/services/activity.service.js');
const executions = await import('../src/services/execution.service.js');

const MON = '2026-01-05';
const TUE = '2026-01-06';
const WED = '2026-01-07';

const newActivity = (title) => activities.createActivity({ title, importance: 'HIGH' });
const countsFor = () => executions.countExecutedByDay(MON, WED);

beforeEach(clearDatabase);

after(() => prisma.$disconnect());

test('exemplo do prompt: conta segunda e quarta, não conta terça', async () => {
  const a = await newActivity('Demanda multi-dia');
  await activities.changeStatus(a.id, 'IN_PROGRESS', { date: MON });
  await activities.changeStatus(a.id, 'COMPLETED', { date: WED });

  const counts = await countsFor();
  assert.equal(counts[MON], 1);
  assert.equal(counts[TUE], undefined);
  assert.equal(counts[WED], 1);

  const detail = await activities.getActivity(a.id);
  assert.equal(detail.status, 'COMPLETED');
  assert.ok(detail.startedAt);
  assert.ok(detail.completedAt);
  assert.deepEqual(detail.logs.map((l) => l.executionDate).sort(), [MON, WED]);
});

test('iniciada e concluída no mesmo dia conta uma única vez e gera um único registro', async () => {
  const a = await newActivity('Rápida');
  await activities.changeStatus(a.id, 'IN_PROGRESS', { date: TUE });
  await activities.changeStatus(a.id, 'COMPLETED', { date: TUE });

  const detail = await activities.getActivity(a.id);
  assert.equal(detail.logs.length, 1);
  assert.equal((await countsFor())[TUE], 1);
});

test('vários registros da mesma atividade no mesmo dia contam uma vez', async () => {
  const a = await newActivity('A');
  const b = await newActivity('B');
  await activities.addLog(a.id, { description: 'manhã', executionDate: MON });
  await activities.addLog(a.id, { description: 'tarde', executionDate: MON });
  await activities.addLog(a.id, { description: 'noite', executionDate: MON, timeSpent: 30 });
  await activities.addLog(b.id, { description: 'única', executionDate: MON });

  const day = await executions.getExecutionsByDate(MON);
  assert.equal(day.executedCount, 2);
  assert.equal(day.activities.find((x) => x.id === a.id).logs.length, 3);
});

test('demanda pendente sem registros nunca é contabilizada', async () => {
  await newActivity('Parada');
  assert.deepEqual(await countsFor(), {});
});

test('registrar execução em demanda pendente a coloca em andamento', async () => {
  const a = await newActivity('Pendente');
  const detail = await activities.addLog(a.id, { description: 'comecei', executionDate: TUE });
  assert.equal(detail.status, 'IN_PROGRESS');
  assert.ok(detail.startedAt);
});

test('conclusão com observação sempre gera registro; sem observação não duplica', async () => {
  const a = await newActivity('Com nota');
  await activities.addLog(a.id, { description: 'trabalho', executionDate: WED });
  await activities.changeStatus(a.id, 'COMPLETED', { date: WED });
  assert.equal((await activities.getActivity(a.id)).logs.length, 1);

  const b = await newActivity('Com nota 2');
  await activities.addLog(b.id, { description: 'trabalho', executionDate: WED });
  await activities.changeStatus(b.id, 'COMPLETED', { date: WED, note: 'Entregue ao cliente' });
  assert.equal((await activities.getActivity(b.id)).logs.length, 2);

  assert.equal((await countsFor())[WED], 2);
});

test('voltar para pendente ou cancelar não gera registro de execução', async () => {
  const a = await newActivity('Cancelada');
  await activities.changeStatus(a.id, 'IN_PROGRESS', { date: MON });
  await activities.changeStatus(a.id, 'PENDING', { date: TUE });
  await activities.changeStatus(a.id, 'CANCELED', { date: WED });

  const counts = await countsFor();
  assert.deepEqual(counts, { [MON]: 1 });
});

test('não permite registrar execução em demanda concluída ou cancelada', async () => {
  const a = await newActivity('Fechada');
  await activities.changeStatus(a.id, 'COMPLETED', { date: MON });
  await assert.rejects(
    activities.addLog(a.id, { description: 'extra', executionDate: TUE }),
    { status: 422 },
  );
});

test('contato concluído conta como execução no dia do contato, sem exigir prazo', async () => {
  const c = await activities.createContact({
    title: 'Dúvida sobre fatura',
    contactName: 'Maria (Financeiro)',
    channel: 'WHATSAPP',
    summary: 'Expliquei o cálculo do reajuste',
    date: TUE,
  });

  assert.equal(c.type, 'CONTACT');
  assert.equal(c.status, 'COMPLETED');
  assert.equal(c.dueDate, null);
  assert.equal(c.isOverdue, false);
  assert.equal(c.logs.length, 1);
  assert.equal(c.logs[0].description, 'Expliquei o cálculo do reajuste');
  assert.deepEqual(await countsFor(), { [TUE]: 1 });
});

test('contato com retorno pendente fica em andamento e pode receber novos registros', async () => {
  const c = await activities.createContact({ title: 'Cliente pediu orçamento', followUp: true, date: MON });
  assert.equal(c.status, 'IN_PROGRESS');
  assert.equal(c.completedAt, null);

  await activities.addLog(c.id, { description: 'Enviei o orçamento', executionDate: WED });
  await activities.changeStatus(c.id, 'COMPLETED', { date: WED });
  assert.deepEqual(await countsFor(), { [MON]: 1, [WED]: 1 });
});

test('importação via API com o mesmo externalId não duplica o contato', async () => {
  const input = { title: 'Mensagem no chat', source: 'google-chat', externalId: 'msg-123', date: MON };
  const first = await activities.createContact(input);
  const second = await activities.createContact(input);

  assert.equal(first.id, second.id);
  assert.equal(await prisma.activity.count(), 1);
  assert.deepEqual(await countsFor(), { [MON]: 1 });
});

test('filtro por tipo separa demandas de contatos', async () => {
  await newActivity('Demanda');
  await activities.createContact({ title: 'Ligação', channel: 'CALL', date: MON });

  assert.deepEqual((await activities.listActivities({ type: 'CONTACT' })).map((a) => a.title), ['Ligação']);
  assert.deepEqual((await activities.listActivities({ type: 'TASK' })).map((a) => a.title), ['Demanda']);
});

test('categoria equivalente reaproveita a grafia existente (maiúsculas, acentos, espaços)', async () => {
  await activities.createActivity({ title: 'A', category: 'Dúvida' });
  const b = await activities.createActivity({ title: 'B', category: '  duvida ' });
  const c = await activities.createContact({ title: 'C', category: 'DÚVIDA', date: MON });
  const d = await activities.createActivity({ title: 'D', category: 'Dúvida  técnica' });

  assert.equal(b.category, 'Dúvida');
  assert.equal(c.category, 'Dúvida');
  assert.equal(d.category, 'Dúvida técnica'); // categoria nova, só com espaços normalizados

  const edited = await activities.updateActivity(d.id, { category: 'duvida' });
  assert.equal(edited.category, 'Dúvida');

  assert.deepEqual(await activities.listCategories(), ['Dúvida']);
  assert.equal((await activities.listActivities({ category: 'Dúvida' })).length, 4);
});

test('demanda vencida e aberta é marcada como atrasada', async () => {
  const late = await activities.createActivity({ title: 'Atrasada', dueDate: '2020-01-01' });
  const done = await activities.createActivity({ title: 'Ok', dueDate: '2020-01-01' });
  await activities.changeStatus(done.id, 'COMPLETED', { date: MON });

  const overdue = await activities.listActivities({ due: 'overdue' });
  assert.deepEqual(overdue.map((x) => x.id), [late.id]);
  assert.equal(overdue[0].isOverdue, true);
});

test('filtro de período: abertas sempre aparecem; fechadas só com movimento no período', async () => {
  const old = new Date('2020-01-01T12:00:00');
  const backdate = (id, extra = {}) =>
    prisma.activity.update({ where: { id }, data: { createdAt: old, ...extra } });

  const oldPending = await newActivity('Pendente antiga');
  await backdate(oldPending.id);

  const oldDone = await newActivity('Concluída antiga');
  await activities.changeStatus(oldDone.id, 'COMPLETED', { date: '2020-01-01' });
  await backdate(oldDone.id, { completedAt: old });

  const doneToday = await newActivity('Concluída hoje');
  await activities.changeStatus(doneToday.id, 'COMPLETED');
  await backdate(doneToday.id); // criada há muito tempo, mas concluída hoje

  const contactOld = await activities.createContact({ title: 'Contato antigo', channel: 'CHAT', date: '2020-01-01' });
  await backdate(contactOld.id, { completedAt: old });

  const titles = async (period) => (await activities.listActivities({ period })).map((a) => a.title).sort();
  assert.deepEqual(await titles('today'), ['Concluída hoje', 'Pendente antiga']);
  assert.deepEqual(await titles('30d'), ['Concluída hoje', 'Pendente antiga']);
  assert.equal((await activities.listActivities({})).length, 4);
});
