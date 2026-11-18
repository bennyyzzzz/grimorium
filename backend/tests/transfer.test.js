// Exportação (JSON/CSV) e importação idempotente.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, clearDatabase } from './helpers/db.js';

const activities = await import('../src/services/activity.service.js');
const { exportActivities, importActivities, previewExport } = await import('../src/services/transfer.service.js');
const { countExecutedByDay } = await import('../src/services/execution.service.js');

const MON = '2026-01-05';
const WED = '2026-01-07';

beforeEach(clearDatabase);
after(() => prisma.$disconnect());

async function seed() {
  const a = await activities.createActivity({ title: 'Relatório "mensal"; fechamento', importance: 'HIGH', category: 'Financeiro' });
  await activities.changeStatus(a.id, 'IN_PROGRESS', { date: MON });
  await activities.addLog(a.id, { description: 'Linha 1\nLinha 2', executionDate: WED, timeSpent: 90 });
  await activities.createContact({ title: '=SOMA(A1)', channel: 'WHATSAPP', contactName: 'Ana', date: WED });
}

const exportJson = async (options = {}) => JSON.parse((await exportActivities(options, 'json')).body);

test('JSON: exporta, importa em base vazia e preserva atividades, registros e contagens', async () => {
  await seed();
  const doc = await exportJson();
  const before = await countExecutedByDay(MON, WED);

  assert.equal(doc.app, 'grimorium');
  assert.equal(doc.count, 2);
  assert.equal(doc.activities[0].logs.length, 2);

  await clearDatabase();
  const result = await importActivities(doc);

  assert.deepEqual(result, { total: 2, created: 2, skipped: 0, errors: [] });
  assert.deepEqual(await countExecutedByDay(MON, WED), before);

  const contact = await prisma.activity.findFirst({ where: { type: 'CONTACT' } });
  assert.equal(contact.channel, 'WHATSAPP');
  assert.equal(contact.contactName, 'Ana');
  assert.equal(contact.uid, doc.activities[1].uid);
});

test('importar o mesmo arquivo duas vezes não duplica', async () => {
  await seed();
  const doc = await exportJson();

  const result = await importActivities(doc);
  assert.deepEqual(result, { total: 2, created: 0, skipped: 2, errors: [] });
  assert.equal(await prisma.activity.count(), 2);
});

test('itens inválidos são relatados sem impedir a importação dos válidos', async () => {
  const result = await importActivities({
    app: 'grimorium',
    version: 1,
    activities: [
      { title: 'Válida', logs: [{ executionDate: MON, description: 'ok' }] },
      { title: '', importance: 'HIGH' },
      { title: 'Prioridade errada', importance: 'URGENTE' },
      { title: 'Log sem data', logs: [{ description: 'x' }] },
    ],
  });

  assert.equal(result.created, 1);
  assert.equal(result.errors.length, 3);
  assert.deepEqual(result.errors.map((e) => e.index), [1, 2, 3]);
  assert.deepEqual(await countExecutedByDay(MON, MON), { [MON]: 1 });
});

test('rejeita arquivo que não é do Grimorium', async () => {
  await assert.rejects(importActivities({ foo: 1 }), { status: 400 });
  await assert.rejects(importActivities({ app: 'outro', activities: [] }), { status: 400 });
});

test('exportação respeita os filtros da lista', async () => {
  await seed();
  const doc = await exportJson({ filters: { type: 'CONTACT' } });
  assert.deepEqual(doc.activities.map((a) => a.type), ['CONTACT']);
});

// Cenário de período: "Antiga" só teve execução em MON; "Recente" em WED (e o contato em WED).
async function seedPeriods() {
  const old = await activities.createActivity({ title: 'Antiga' });
  await activities.addLog(old.id, { description: 'seg', executionDate: MON });
  const recent = await activities.createActivity({ title: 'Recente' });
  await activities.addLog(recent.id, { description: 'seg', executionDate: MON });
  await activities.addLog(recent.id, { description: 'qua', executionDate: WED });
  // createdAt de ambas é "agora"; para testar período por execução, movemos a criação para o passado
  await prisma.activity.updateMany({ data: { createdAt: new Date(`${MON}T09:00:00`) } });
  return { old, recent };
}

test('período: inclui só atividades com execução no período; JSON leva o histórico completo', async () => {
  await seedPeriods();
  const doc = await exportJson({ period: { from: WED, to: WED } });

  assert.deepEqual(doc.activities.map((a) => a.title), ['Recente']);
  assert.equal(doc.activities[0].logs.length, 2); // seg + qua: backup íntegro
  assert.deepEqual(doc.scope.period, { from: WED, to: WED });
});

test('período: CSVs consideram apenas os registros do período', async () => {
  await seedPeriods();
  const period = { from: WED, to: WED };

  const logs = await exportActivities({ period }, 'csv-logs');
  const rows = logs.body.slice(1).trim().split('\r\n').slice(1);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].startsWith(WED));
  assert.equal(logs.filename, `grimorium-registros-${WED}.csv`);

  const acts = await exportActivities({ period }, 'csv');
  assert.ok(acts.body.includes('Registros no período'));
});

test('período: atividade criada no período entra mesmo sem execução', async () => {
  await seedPeriods();
  const created = await activities.createActivity({ title: 'Nova sem execução' });
  await prisma.activity.update({ where: { id: created.id }, data: { createdAt: new Date(`${WED}T10:00:00`) } });

  const doc = await exportJson({ period: { from: WED, to: WED } });
  assert.deepEqual(doc.activities.map((a) => a.title).sort(), ['Nova sem execução', 'Recente']);
});

test('seleção manual: exporta apenas os ids escolhidos', async () => {
  const { old } = await seedPeriods();
  const doc = await exportJson({ ids: [old.id] });
  assert.deepEqual(doc.activities.map((a) => a.title), ['Antiga']);
});

test('prévia: conta atividades, registros totais e registros do período', async () => {
  await seedPeriods();
  assert.deepEqual(await previewExport({ period: { from: WED, to: WED } }), {
    activities: 1,
    logs: 2,
    logsInPeriod: 1,
  });
  assert.deepEqual(await previewExport({}), { activities: 2, logs: 3, logsInPeriod: 3 });
});

test('CSV: separador ";", BOM, aspas e quebras de linha escapadas, fórmulas neutralizadas', async () => {
  await seed();
  const { body, filename } = await exportActivities({}, 'csv');

  assert.match(filename, /^grimorium-atividades-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.ok(body.startsWith('﻿'));
  const lines = body.slice(1).split('\r\n');
  assert.ok(lines[0].startsWith('ID;Tipo;Título;'));
  assert.ok(body.includes('"Relatório ""mensal""; fechamento"'));
  assert.ok(body.includes("'=SOMA(A1)"));
});

test('CSV de registros: uma linha por execução, em ordem de data', async () => {
  await seed();
  const { body } = await exportActivities({}, 'csv-logs');
  const rows = body.slice(1).trim().split('\r\n').slice(1);

  assert.equal(rows.length, 3); // A: seg + qua; contato: qua
  assert.ok(rows[0].startsWith(MON));
  assert.ok(body.includes('"Linha 1\nLinha 2"'));
});
