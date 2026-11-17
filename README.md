# Grimorium

Gerenciador pessoal de demandas, registros de execução diária e relatórios gerados com IA (Claude API).

## Stack

- **Frontend:** React 19 + Vite 7 + React Router 7 + CSS puro (`frontend/`)
- **Backend:** Node.js 20+ + Express 5 + Prisma 6 + SQLite (`backend/`)

## Executar

```bash
# 1ª vez: instala dependências e cria o banco SQLite (backend/prisma/dev.db)
cp backend/.env.example backend/.env   # se ainda não existir
npm run setup

# Sobe backend (http://localhost:3333) e frontend (http://localhost:5173)
npm run dev
```

Também é possível rodar separadamente: `npm run dev:backend` e `npm run dev:frontend`.

## Validar

| O quê | Como |
|---|---|
| Backend | `GET http://localhost:3333/api/health` retorna `"api": "ok"` |
| Banco | Na mesma resposta, `"database": { "status": "ok", "counts": {...} }` |
| Frontend | `http://localhost:5173`: navegação entre Dashboard, Demandas e Relatórios |
| Integração | Indicador verde "API e banco online" no rodapé da barra lateral (a chamada passa pelo proxy do Vite) |
| Dados | `npm run prisma:studio --prefix backend` abre o Prisma Studio para inspecionar as tabelas |

## Estrutura

```text
backend/
  prisma/schema.prisma       Activity, ActivityLog, Report
  src/
    app.js                   montagem do Express (middlewares + rotas)
    server.js                bootstrap e encerramento gracioso
    lib/prisma.js            instância única do Prisma Client
    routes/ controllers/ services/ middlewares/ utils/
frontend/
  src/
    components/              Layout, PageHeader, EmptyState
    pages/                   Dashboard, Demandas, Relatorios
    services/api.js          cliente HTTP central
    hooks/useApiHealth.js
    styles/global.css        tokens de design
```

## Regra central de dados

`Activity` é a demanda cadastrada; `ActivityLog` é o trabalho efetivamente executado em uma data (`executionDate` no formato `YYYY-MM-DD`). Indicadores e relatórios contam **atividades distintas com log na data**, nunca demandas apenas abertas.

| Ação | Efeito nos registros de execução |
|---|---|
| Iniciar (1ª vez) | define `startedAt` e cria o registro "Demanda iniciada" |
| Registrar execução | cria um registro; se a demanda estiver pendente, ela passa para "em andamento" |
| Concluir | define `completedAt`; cria "Demanda concluída" **somente se** não houver registro no dia |
| Observação ao mudar status | sempre vira um registro |
| Voltar para pendente / cancelar / reabrir | não gera registro (não é trabalho executado) |
| Registrar contato | cria a atividade `CONTACT` já com o registro na data do contato; concluída, ou em andamento se "requer retorno" |

Contatos têm `source` (`manual` por padrão) e `externalId`, únicos em conjunto: integrações futuras (Google Chat, WhatsApp...) podem chamar `createContact` com o id da mensagem de origem sem gerar duplicatas.

Testes automatizados da regra (banco isolado `test.db`): `npm test --prefix backend`

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/activities?search&type&status&importance&category&due` | lista (`type`: `TASK`, `CONTACT`; `due`: `overdue`, `today`, `week`, `none`) |
| POST | `/api/activities/contacts` | registra contato em um passo (`title`, `channel`, `contactName?`, `summary?`, `date?`, `timeSpent?`, `followUp?`, `dueDate?`) |
| GET | `/api/activities/categories` | categorias existentes |
| GET | `/api/activities/:id` | detalhe com registros |
| POST | `/api/activities` | cria (`title`, `description`, `category`, `importance`, `dueDate`) |
| PUT | `/api/activities/:id` | edita |
| DELETE | `/api/activities/:id` | exclui (com os registros) |
| PATCH | `/api/activities/:id/status` | altera status (`status`, `note?`, `date?`) |
| POST | `/api/activities/:id/logs` | registra execução (`description`, `timeSpent?`, `executionDate?`) |
| DELETE | `/api/activities/:id/logs/:logId` | remove registro |
| GET | `/api/executions?date=YYYY-MM-DD` | atividades efetivamente executadas no dia |
| GET | `/api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | indicadores do período (máx. 366 dias) + situação atual |

## Indicadores do Dashboard

| Indicador | Cálculo |
|---|---|
| Atividades executadas | atividades **distintas** com ao menos um registro no período |
| Série diária | atividades distintas por dia (a mesma atividade conta uma vez por dia) |
| Média por dia | soma dos totais diários ÷ dias do período |
| Concluídas | atividades com `completedAt` dentro do período |
| Tempo registrado | soma de `timeSpent` dos registros do período |
| Pendentes / Em andamento / Atrasadas | situação **atual**, independe do período |

O período fica na URL (`/?periodo=7d`, `/?de=2026-11-01&ate=2026-11-15`) e os cards de situação abrem a lista já filtrada (`/demandas?status=PENDING`).

## Roadmap

1. ~~Estrutura inicial~~
2. ~~Gerenciamento de demandas (CRUD, filtros, status, registros de execução)~~
3. ~~Dashboard (indicadores e gráficos por período)~~
4. Relatórios (Claude API, PDF, histórico)
5. Refinamentos
