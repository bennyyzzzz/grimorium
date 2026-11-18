# Grimorium

Gerenciador pessoal de demandas, registros de execução diária e relatórios gerados com IA (Claude API).

## Stack

- **Frontend:** React 19 + Vite 7 + React Router 7 + CSS puro (`frontend/`)
- **Backend:** Node.js 20+ + Express 5 + Prisma 6 + SQLite (`backend/`)

## Executar

```bash
# 1ª vez: instala dependências e cria/atualiza o banco SQLite (backend/prisma/dev.db)
# (o iniciar-grimorium.cmd faz isso sozinho — ver "Uso diário" abaixo)
cp backend/.env.example backend/.env   # se ainda não existir
npm run setup

# Sobe backend (http://localhost:3333) e frontend (http://localhost:5173)
npm run dev
```

Também é possível rodar separadamente: `npm run dev:backend` e `npm run dev:frontend`.

### Uso diário (sem VS Code)

Único pré-requisito: **Node.js** instalado ([nodejs.org](https://nodejs.org)).

Dê dois cliques em **`iniciar-grimorium.cmd`** (ou no atalho **Grimorium** da Área de Trabalho). Ele:

1. Se o Grimorium já estiver rodando, apenas abre o navegador.
2. Cria `backend/.env` a partir do `.env.example`, se não existir.
3. **No primeiro uso**, instala todas as dependências e cria o banco (alguns minutos, só uma vez).
4. A cada abertura, aplica migrações pendentes do banco (`prisma migrate deploy` — nunca apaga dados).
5. Sobe backend e frontend e abre o navegador quando estiver pronto.

Para encerrar, feche a janela do terminal.

Para recriar o atalho em outra máquina: botão direito em `iniciar-grimorium.cmd` → **Mostrar mais opções → Enviar para → Área de trabalho (criar atalho)**; em Propriedades → Alterar ícone, use `assets/grimorium.ico`.

## ⚠️ Seus dados ficam só neste computador

O Grimorium é **local**: não há backup em nuvem nem servidor. Tudo fica no PC onde ele roda:

| O quê | Onde |
|---|---|
| Demandas, contatos, registros, Biblioteca, relatórios | `backend/prisma/dev.db` (banco SQLite) |
| Anexos da Biblioteca | `backend/storage/` |
| Configurações e chaves (Claude, GitHub) | `backend/.env` |

**Faça backups manuais** — para não perder dados (formatação, troca de PC, disco com defeito) ou para usar em outra máquina:

- **Pelo app:** Demandas → **Exportar / Importar** → Backup completo (JSON). Cobre demandas, contatos e registros; importe na outra máquina pelo mesmo painel.
- **Cópia completa** (inclui a Biblioteca e os anexos): com o Grimorium fechado, copie `backend/prisma/dev.db` e a pasta `backend/storage/` para um local seguro (pendrive, nuvem pessoal etc.).

O aviso também aparece no rodapé da barra lateral (link **Fazer backup**) e no topo do painel de exportação.

📄 **Passo a passo para levar o banco para outro computador:** [docs/levar-para-outro-computador.md](docs/levar-para-outro-computador.md)

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
| GET | `/api/transfer/export?format=json\|csv\|csv-logs&from&to&ids&[filtros da lista]` | download do backup/planilha |
| GET | `/api/transfer/export/preview?from&to&ids&[filtros]` | prévia: atividades e registros que sairão no arquivo |
| POST | `/api/transfer/import` | importa um backup JSON (até 20 MB) |

## Biblioteca

Repositório pessoal de **passo a passo, testes, código/programação e anotações** (`/biblioteca`).

- Conteúdo em **Markdown** com abas Escrever/Visualizar, destaque de sintaxe e botão de copiar em cada bloco de código. HTML embutido no texto não é executado.
- Cada tipo começa com um modelo (ex.: Objetivo → Pré-requisitos → Passo a passo). Tags, resumo, entradas fixadas e busca por título/conteúdo/tag.
- **Copiar como Markdown** gera o texto pronto para colar em chat, e-mail, GitHub ou Notion.
- **Anexos** (até 25 MB, 10 por envio) ficam em `backend/storage/library/` com nome aleatório; só imagens comuns abrem no navegador, o resto é sempre baixado. Inclua essa pasta nos seus backups — o backup JSON de atividades ainda não cobre a Biblioteca.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/library?search&kind&tag` | lista (`kind`: `HOWTO`, `TEST`, `SNIPPET`, `NOTE`) |
| GET | `/api/library/tags` | tags em uso com contagem |
| GET/POST/PUT/DELETE | `/api/library[/:id]` | CRUD de entradas |
| POST | `/api/library/:id/attachments` | upload multipart (campo `files`) |
| GET/DELETE | `/api/library/:id/attachments/:attachmentId` | baixar (`?inline=1` para imagens) / excluir |
| POST | `/api/library/import-github` | importa arquivo do GitHub/Gist por link (`{ url }`) |
| POST | `/api/library/:id/sync-github` | atualiza o código importado (anotações preservadas) |
| GET | `/api/library/github/status` | indica se há `GITHUB_TOKEN` configurado |

### Importar do GitHub

Cole o link de um arquivo (`github.com/…/blob/branch/caminho`, link raw ou Gist). O código fica **separado das anotações**: "Atualizar do GitHub" troca só o código. Importar o mesmo arquivo de novo abre a entrada existente. O backend só consulta `api.github.com` — o link é apenas interpretado.

Repositórios **públicos** funcionam sem configuração. Para **privados**, crie um *fine-grained token* em GitHub → Settings → Developer settings → Personal access tokens, com acesso aos repositórios desejados e permissão **Contents: Read-only**, e coloque em `backend/.env` como `GITHUB_TOKEN=`.

## Exportar e importar

Na tela Demandas → **Exportar / Importar**:

| Formato | Conteúdo | Importável |
|---|---|---|
| Backup completo (JSON) | atividades + todos os registros de execução | sim |
| Planilha de atividades (CSV) | uma linha por demanda/contato, com totais | não |
| Planilha de registros (CSV) | uma linha por execução | não |

- **Recorte:** por período (7 dias, 30 dias — padrão —, este mês, tudo ou personalizado), opcionalmente com os filtros da lista, ou pelos **itens selecionados** na tabela. O painel mostra a prévia antes de baixar.
- **Período:** entram as atividades com execução **ou** criação no período. Os CSVs trazem apenas os registros do período; o JSON leva o histórico **completo** de cada atividade incluída (backup íntegro — importar recortes diferentes depois não perde registros).
- CSV pronto para Excel em português: separador `;`, UTF-8 com BOM, células iniciadas por `= + - @` são neutralizadas.
- Cada atividade tem um `uid` universal. Importar o mesmo backup de novo (ou em outra conta que já o recebeu) ignora os itens existentes, sem duplicar.
- Itens inválidos no arquivo são listados com o motivo; os válidos são importados normalmente.

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

### Objetivos futuros

- **Aplicativo instalável (PWA):** manifesto + ícones + service worker para "Instalar" pelo Edge/Chrome e usar em janela própria, com ícone no menu Iniciar e na barra de tarefas.
- **Servidor único de produção:** o backend serve o build do frontend em um só endereço (`npm start` → `http://localhost:3333`), sem o modo de desenvolvimento.
- **Iniciar com o Windows:** servidor sobe sozinho em segundo plano ao ligar o PC (pré-requisito para o app instalado abrir sempre funcionando).
- **Biblioteca no backup:** incluir entradas e anexos da Biblioteca na exportação/importação.
- **Gerenciar categorias:** renomear, juntar e excluir categorias de demandas.
- Itens do prompt original: integração com Google Chat, captura automática de demandas, Google Sheets, relatórios agendados e semanais, histórico de produtividade, sugestões de priorização por IA.
