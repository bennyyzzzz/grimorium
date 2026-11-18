# Grimorium

Gerenciador pessoal de demandas, registros de execução diária, biblioteca de anotações e relatórios gerados com IA (Claude API). Roda localmente, sem nuvem.

**Conteúdo:** [Requisitos](#requisitos) · [Executar](#executar) · [Seus dados](#-seus-dados-ficam-só-neste-computador) · [Funcionalidades](#funcionalidades) · [Regra central](#regra-central-de-dados) · [API](#api) · [Validar](#validar-e-testar) · [Estrutura](#estrutura) · [Problemas comuns](#problemas-comuns) · [Roadmap](#roadmap)

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend (`frontend/`) | React 19, Vite 7, React Router 7, CSS puro |
| Backend (`backend/`) | Node.js, Express 5, Prisma 6, SQLite |

## Requisitos

- **Node.js 20.19+ ou 22.12+** (testado com 22; o projeto indica a 22 em `.nvmrc`). Versões mais antigas falham: o Vite 7 exige essa faixa e o backend usa `node --env-file`, que não existe no Node 18. O Grimorium verifica a versão ao iniciar e explica o que instalar.
- **Windows:** instalador LTS em [nodejs.org](https://nodejs.org).
- **Linux / WSL / macOS** com [nvm](https://github.com/nvm-sh/nvm): `nvm install 22`, depois `nvm use 22` na sessão atual e `nvm alias default 22` para tornar o 22 o padrão em terminais novos.

## Executar

Escolha conforme o sistema — a preparação é automática em todos:

| Sistema | Como iniciar |
|---|---|
| **Windows** | dois cliques em **`iniciar-grimorium.cmd`** (ou no atalho **Grimorium** da Área de Trabalho) |
| **Linux / WSL / macOS** | `sh iniciar-grimorium.sh` |
| **Qualquer terminal** | `npm start` (abre o navegador) ou `npm run dev` (sem abrir) |

Endereços: frontend em `http://localhost:5173`, API em `http://localhost:3333`. Para encerrar, feche a janela do terminal ou pressione Ctrl+C.

### O que a preparação faz sozinha

Antes de subir, `npm start`, `npm run dev` e `npm run setup` executam [`scripts/preflight.mjs`](scripts/preflight.mjs), que:

1. Confere a versão do Node.js e explica o que instalar, se for antiga.
2. Cria `backend/.env` a partir do `.env.example`, se não existir.
3. Instala as dependências da raiz, do backend e do frontend quando faltam, quando foram instaladas **em outro sistema** (ex.: WSL × Windows na mesma pasta) ou quando o `package-lock.json` mudou (ex.: depois de um `git pull`). Usa `npm ci`, que **não altera** os lockfiles versionados.
4. Gera o Prisma Client se o schema mudou e aplica migrações pendentes (`prisma migrate deploy`, que nunca apaga dados).

Na primeira vez leva alguns minutos; depois, poucos segundos. Se precisar reinstalar algo com o Grimorium aberto, ele pede para fechar antes (evita corromper a instalação).

> **WSL e Windows:** escolha **um** dos dois para rodar o projeto. As dependências são específicas de cada sistema; se alternar, a preparação reinstala tudo a cada troca. No WSL, pastas Linux (ex.: `~/grimorium`) são bem mais rápidas que `/mnt/c` ou `/mnt/d`.

Backend e frontend também rodam separados: `npm run dev:backend` e `npm run dev:frontend` (sem a preparação automática).

### Uso diário no Windows (sem VS Code)

Dê dois cliques em **`iniciar-grimorium.cmd`** ou no atalho **Grimorium** da Área de Trabalho. Se o Grimorium já estiver rodando, ele só abre o navegador; senão, prepara tudo (acima), sobe o sistema e abre o navegador quando estiver pronto.

Para recriar o atalho em outra máquina: botão direito em `iniciar-grimorium.cmd` → **Mostrar mais opções → Enviar para → Área de trabalho (criar atalho)**; em Propriedades → Alterar ícone, use `assets/grimorium.ico`.

## ⚠️ Seus dados ficam só neste computador

Não há backup em nuvem nem servidor. Tudo fica no PC onde o Grimorium roda:

| O quê | Onde |
|---|---|
| Demandas, contatos, registros, Biblioteca, relatórios | `backend/prisma/dev.db` (SQLite) |
| Anexos da Biblioteca | `backend/storage/` |
| Configurações e chaves (Claude, GitHub) | `backend/.env` |

**Faça backups manuais** (formatação, troca de PC ou disco com defeito):

- **Pelo app (recomendado):** Demandas → **Exportar / Importar** → período **Tudo** → **Backup completo (.zip)** com **Incluir a Biblioteca** marcado. Restaure em outra máquina pelo mesmo painel (Importar backup). Guarde o arquivo **fora deste computador**.
- **Cópia dos arquivos:** com o Grimorium fechado, copie `backend/prisma/dev.db` e a pasta `backend/storage/`.
- As chaves do `backend/.env` **não** entram no `.zip`, por segurança. Anote-as em local seguro ou gere novas.

O aviso também aparece na barra lateral (link **Fazer backup**) e no topo do painel de exportação.

📄 Passo a passo para outro computador: [docs/levar-para-outro-computador.md](docs/levar-para-outro-computador.md)

## Funcionalidades

### Demandas

Cadastro de demandas e contatos, filtros, mudança de status e registros de execução. Contatos (chat, WhatsApp, ligação) entram em um passo só, já contando como trabalho executado no dia.

### Dashboard

Indicadores e gráficos por período. O período fica na URL (`/?periodo=7d`, `/?de=2026-11-01&ate=2026-11-15`) e os cards de situação abrem a lista já filtrada (`/demandas?status=PENDING`).

| Indicador | Cálculo |
|---|---|
| Atividades executadas | atividades **distintas** com ao menos um registro no período |
| Série diária | atividades distintas por dia (a mesma atividade conta uma vez por dia) |
| Média por dia | soma dos totais diários ÷ dias do período |
| Concluídas | atividades com `completedAt` dentro do período |
| Tempo registrado | soma de `timeSpent` dos registros do período |
| Pendentes / Em andamento / Atrasadas | situação **atual**, independe do período |

### Biblioteca

Repositório pessoal de **passo a passo, testes, código e anotações** (`/biblioteca`).

- Conteúdo em **Markdown** com abas Escrever/Visualizar, destaque de sintaxe e botão de copiar em cada bloco de código. HTML embutido no texto não é executado.
- Cada tipo começa com um modelo (Objetivo → Pré-requisitos → Passo a passo). Há tags, resumo, entradas fixadas e busca por título, conteúdo e tag.
- **Copiar como Markdown** gera o texto pronto para colar em chat, e-mail, GitHub ou Notion.
- **Anexos** (até 25 MB, 10 por envio) ficam em `backend/storage/library/` com nome aleatório. Só imagens comuns abrem no navegador; o resto é sempre baixado.

**Importar do GitHub:** cole o link de **um arquivo** (`github.com/…/blob/branch/caminho`), um link raw ou um Gist. Links de repositório ou de pasta não funcionam. O código fica separado das anotações: "Atualizar do GitHub" troca só o código. Importar o mesmo arquivo de novo abre a entrada existente. O backend só consulta `api.github.com`.

Repositórios **públicos** funcionam sem configuração. Para **privados**, crie um *fine-grained token* (GitHub → Settings → Developer settings → Personal access tokens) com permissão **Contents: Read-only** e coloque em `backend/.env` como `GITHUB_TOKEN=`.

### Exportar e importar

Em Demandas → **Exportar / Importar**:

| Formato | Conteúdo | Importável |
|---|---|---|
| Backup completo (.zip) | `grimorium-backup.json` (atividades, registros e Biblioteca) + pasta `attachments/` | sim |
| Planilha de atividades (CSV) | uma linha por demanda/contato, com totais | não |
| Planilha de registros (CSV) | uma linha por execução | não |

- **Recorte:** por período (7 dias, 30 dias como padrão, este mês, tudo ou personalizado), com ou sem os filtros da lista, ou pelos **itens selecionados**. O painel mostra uma prévia antes de baixar.
- **Biblioteca:** com **Incluir a Biblioteca** marcado (padrão), vai inteira, com anexos. Não usa período nem seleção.
- **Período:** entram as atividades com execução **ou** criação no período. Os CSVs trazem só os registros do período; o backup leva o histórico **completo** de cada atividade incluída.
- **Sem duplicatas:** cada atividade tem um `uid` universal, e importar o mesmo backup de novo ignora os itens existentes. Itens inválidos são listados com o motivo, e os válidos entram normalmente.
- **Segurança:** o `.zip` é verificado (tamanho total, presença do `grimorium-backup.json`, anexos só em `attachments/<uid>/<arquivo>`). Os anexos ganham nomes novos e nunca são gravados fora da pasta da Biblioteca.
- **Excel em português:** separador `;`, UTF-8 com BOM, e células iniciadas por `= + - @` são neutralizadas.
- Backups `.json` antigos (só atividades) continuam importáveis.

### Aparência

- **Tema:** Claro, Escuro ou Sistema, escolhido no rodapé da barra lateral e salvo no navegador. No modo Sistema, o tema acompanha o sistema operacional.
- **Estilo:** inspirado nas Human Interface Guidelines da Apple, com Liquid Glass (superfícies translúcidas com desfoque e brilho nas bordas) e rosa como cor de destaque.
- **Acessibilidade:** com "reduzir transparência" ativo no sistema, as superfícies ficam sólidas. O mesmo vale para navegadores sem suporte a `backdrop-filter`.
- **Onde ajustar:** cores e medidas em `frontend/src/styles/global.css` (a cor de destaque é `--accent`, uma em cada tema); o efeito de vidro em `frontend/src/styles/glass.css`.

## Regra central de dados

`Activity` é a demanda cadastrada. `ActivityLog` é o trabalho efetivamente executado em uma data (`executionDate`, formato `YYYY-MM-DD`). Indicadores e relatórios contam **atividades distintas com registro na data**, nunca demandas apenas abertas.

| Ação | Efeito nos registros de execução |
|---|---|
| Iniciar (1ª vez) | define `startedAt` e cria o registro "Demanda iniciada" |
| Registrar execução | cria um registro; se a demanda estiver pendente, passa para "em andamento" |
| Concluir | define `completedAt`; cria "Demanda concluída" **somente se** não houver registro no dia |
| Observação ao mudar status | sempre vira um registro |
| Voltar para pendente, cancelar ou reabrir | não gera registro (não é trabalho executado) |
| Registrar contato | cria a atividade `CONTACT` com o registro na data do contato; concluída, ou em andamento se "requer retorno" |

Contatos têm `source` (`manual` por padrão) e `externalId`, únicos em conjunto. Integrações futuras (Google Chat, WhatsApp) podem chamar `createContact` com o id da mensagem de origem sem gerar duplicatas.

## API

Base: `http://localhost:3333`.

### Demandas e execuções

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/activities?search&type&status&importance&category&due` | lista (`type`: `TASK`, `CONTACT`; `due`: `overdue`, `today`, `week`, `none`) |
| POST | `/api/activities/contacts` | registra contato em um passo (`title`, `channel`, `contactName?`, `summary?`, `date?`, `timeSpent?`, `followUp?`, `dueDate?`) |
| GET | `/api/activities/categories` | categorias existentes |
| GET | `/api/activities/:id` | detalhe com registros |
| POST | `/api/activities` | cria (`title`, `description`, `category`, `importance`, `dueDate`) |
| PUT | `/api/activities/:id` | edita |
| DELETE | `/api/activities/:id` | exclui, com os registros |
| PATCH | `/api/activities/:id/status` | altera status (`status`, `note?`, `date?`) |
| POST | `/api/activities/:id/logs` | registra execução (`description`, `timeSpent?`, `executionDate?`) |
| DELETE | `/api/activities/:id/logs/:logId` | remove registro |
| GET | `/api/executions?date=YYYY-MM-DD` | atividades executadas no dia |
| GET | `/api/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | indicadores do período (máx. 366 dias) e situação atual |

### Exportar e importar

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/transfer/export?format=json\|csv\|csv-logs&from&to&ids&[filtros da lista]` | download do backup ou da planilha |
| GET | `/api/transfer/export/preview?from&to&ids&[filtros]` | prévia do que sairá no arquivo |
| POST | `/api/transfer/import` | importa backup `.json` antigo (até 20 MB) |
| POST | `/api/transfer/import-zip` | importa backup `.zip` (multipart, campo `file`, até 1 GB) |

### Biblioteca

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/library?search&kind&tag` | lista (`kind`: `HOWTO`, `TEST`, `SNIPPET`, `NOTE`) |
| GET | `/api/library/tags` | tags em uso, com contagem |
| GET/POST/PUT/DELETE | `/api/library[/:id]` | CRUD de entradas |
| POST | `/api/library/:id/attachments` | upload multipart (campo `files`) |
| GET/DELETE | `/api/library/:id/attachments/:attachmentId` | baixar (`?inline=1` para imagens) ou excluir |
| POST | `/api/library/import-github` | importa arquivo do GitHub/Gist por link (`{ url }`) |
| POST | `/api/library/:id/sync-github` | atualiza o código importado, preservando as anotações |
| GET | `/api/library/github/status` | indica se há `GITHUB_TOKEN` configurado |

## Validar e testar

| O quê | Como |
|---|---|
| Backend | `GET http://localhost:3333/api/health` retorna `"api": "ok"` |
| Banco | na mesma resposta, `"database": { "status": "ok", "counts": {...} }` |
| Frontend | `http://localhost:5173` abre, com navegação entre Dashboard, Demandas, Biblioteca e Relatórios |
| Integração | indicador verde "API e banco online" no rodapé da barra lateral (a chamada passa pelo proxy do Vite) |
| Dados | `npm run prisma:studio --prefix backend` abre o Prisma Studio |
| Testes | `npm test --prefix backend` (usa o banco isolado `test.db`) |

## Estrutura

```text
backend/
  prisma/schema.prisma       Activity, ActivityLog, Report e Biblioteca
  src/
    app.js                   Express: middlewares e rotas
    server.js                bootstrap e encerramento gracioso
    lib/prisma.js            instância única do Prisma Client
    routes/ controllers/ services/ middlewares/ validators/ utils/
  tests/                     testes automatizados (node --test)
frontend/
  src/
    components/              Layout, ThemeToggle, BackLink, Modal, gráficos...
    pages/                   Dashboard, Demandas, Biblioteca, Relatórios
    hooks/                   useApiHealth, useTheme, useConfirm...
    services/api.js          cliente HTTP central
    styles/                  global.css (tokens), ui.css (componentes), glass.css (Liquid Glass)
docs/                        guias (ex.: levar o banco para outro computador)
scripts/preflight.mjs        preparação automática antes de iniciar (Node, .env, dependências, banco)
iniciar-grimorium.cmd / .sh  inicialização no Windows / Linux, WSL e macOS
```

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `node: bad option: --env-file=.env` | Node antigo (18 ou menor). Rode `nvm use 22`. |
| `crypto.hash is not a function` ou aviso "Vite requires Node.js version 20.19+" | Mesma causa. Use Node 20.19+ ou 22.12+. |
| A versão volta para a antiga ao abrir outro terminal | O `nvm use` vale só para o terminal atual. Rode `nvm alias default 22` uma vez. |
| "As dependências precisam ser (re)instaladas, mas o Grimorium está em execução" | Feche o Grimorium (janela do terminal ou `npm run dev`) e inicie de novo. |
| Lentidão no WSL ou reinstalação a cada abertura | Rode o projeto em **um** ambiente só (WSL ou Windows) e, no WSL, numa pasta Linux (`~/grimorium`). |
| "Indicador vermelho: API offline" | O backend não subiu. Veja o terminal (`[api]`) e confira o `backend/.env`. |
| Importar do GitHub recusa o link | Use o link de um arquivo (`…/blob/branch/caminho/arquivo`), não de um repositório ou pasta. |
| Repositório privado não importa | Configure `GITHUB_TOKEN` em `backend/.env` e reinicie o backend. |

## Roadmap

1. ~~Estrutura inicial~~
2. ~~Gerenciamento de demandas (CRUD, filtros, status, registros de execução)~~
3. ~~Dashboard (indicadores e gráficos por período)~~
4. Relatórios (Claude API, PDF, histórico)
5. Refinamentos

### Objetivos futuros

- **Aplicativo instalável (PWA):** manifesto, ícones e service worker para instalar pelo Edge/Chrome e usar em janela própria.
- **Servidor único de produção:** o backend serve o build do frontend em um só endereço (`npm start` → `http://localhost:3333`), sem o modo de desenvolvimento.
- **Iniciar com o Windows:** servidor sobe sozinho em segundo plano ao ligar o PC.
- **Backup automático:** cópia periódica (ao abrir e diariamente) para uma pasta fora da área sujeita a limpeza (unidade de rede, segundo disco, nuvem pessoal), mantendo as últimas N cópias.
- **Gerenciar categorias:** renomear, juntar e excluir categorias de demandas.
- Itens do prompt original: integração com Google Chat, captura automática de demandas, Google Sheets, relatórios agendados e semanais, histórico de produtividade, sugestões de priorização por IA.
