# Projeto: Gerenciador de Demandas e Relatórios Diários

Atue como um desenvolvedor Full Stack Sênior, com experiência em React, Node.js, Express, Prisma e SQLite.

Quero desenvolver uma aplicação web para gerenciamento de demandas profissionais, acompanhamento de atividades e geração automatizada de relatórios diários utilizando inteligência artificial (Claude API).

O projeto deve ser desenvolvido de forma organizada, modular e escalável, mas sem adicionar complexidade desnecessária ao MVP.

## 1. Objetivo do sistema

Desenvolver uma ferramenta pessoal que permita:

- Cadastrar demandas manualmente.
- Organizar atividades por prioridade, categoria e prazo.
- Acompanhar o andamento das demandas.
- Registrar o trabalho realizado em cada dia.
- Identificar atividades atrasadas e pendentes.
- Visualizar indicadores de produtividade.
- Gerar relatórios diários estruturados utilizando a Claude API.
- Consultar e baixar relatórios anteriores em PDF.

A primeira versão será utilizada individualmente. Não implementar autenticação, múltiplos usuários ou integração com Google Chat neste momento.

## 2. Tecnologias

### Frontend
- React
- Vite
- JavaScript
- CSS puro
- React Router para navegação entre telas.

### Backend
- Node.js
- Express
- Prisma ORM
- SQLite como banco de dados inicial.

### Inteligência artificial
- Claude API (Anthropic).
- A integração deve acontecer exclusivamente pelo backend.
- A chave da API deve ficar armazenada em variável de ambiente.
- Não expor credenciais no frontend.

### Relatórios
- Gerar documentos PDF pelo backend.
- Armazenar os dados dos relatórios no banco.
- Permitir visualizar e baixar relatórios anteriores.

## 3. Estrutura da aplicação

A aplicação terá três telas principais:

### 3.1. Dashboard

Tela inicial com uma visão geral das atividades.

Indicadores:

- Atividades executadas hoje.
- Demandas pendentes.
- Demandas em andamento.
- Demandas atrasadas.
- Atividades executadas por nível de importância.

Criar gráficos para visualizar a distribuição das atividades por prioridade:

- Alta.
- Média.
- Baixa.

Adicionar filtros de período:

- Hoje.
- Últimos 7 dias.
- Últimos 30 dias.
- Período personalizado.

IMPORTANTE: os indicadores de produtividade devem considerar os registros reais de execução das atividades, e não simplesmente a quantidade de demandas cadastradas.

### 3.2. Demandas

Tela responsável pelo gerenciamento das atividades.

Funcionalidades:

- Cadastrar uma nova demanda.
- Editar uma demanda existente.
- Visualizar detalhes.
- Alterar status.
- Registrar uma execução diária.
- Marcar uma demanda como concluída.
- Filtrar por prioridade, categoria, status e prazo.
- Pesquisar pelo título ou descrição.
- Identificar visualmente demandas atrasadas.

Cada demanda deverá possuir:

- Título.
- Descrição.
- Categoria.
- Prioridade.
- Status.
- Data de criação.
- Data de início.
- Prazo de entrega.
- Data de conclusão, quando aplicável.

Prioridades:

- Alta.
- Média.
- Baixa.

Status:

- Pendente.
- Em andamento.
- Concluída.
- Cancelada.

O cadastro deve ser simples e rápido, evitando formulários excessivamente complexos.

### 3.3. Relatórios

Tela exclusiva para consulta e gerenciamento dos relatórios gerados.

Funcionalidades:

- Botão para gerar relatório do dia.
- Listagem de relatórios anteriores.
- Identificação da data de referência.
- Visualização do relatório.
- Download em PDF.

O relatório deverá ser gerado utilizando os dados das atividades e seus respectivos registros de execução.

A IA deverá organizar as informações em uma estrutura profissional, clara e objetiva.

Estrutura sugerida:

1. Resumo geral do dia.
2. Indicadores de atividades executadas.
3. Atividades realizadas, organizadas por categoria.
4. Detalhamento das principais entregas.
5. Pontos de atenção.
6. Demandas pendentes para acompanhamento.

A IA poderá agrupar atividades relacionadas em temas, mas deverá preservar as informações individuais de cada demanda.

Não inventar atividades, resultados, prazos ou entregas. Quando não houver informação suficiente, não presumir o que foi realizado.

## 4. Regra fundamental: contabilização das atividades

Esta é uma das partes mais importantes do sistema.

Precisamos diferenciar uma demanda cadastrada de uma atividade efetivamente executada.

Uma demanda pode permanecer aberta durante vários dias, mas não deve ser contabilizada repetidamente apenas por continuar pendente.

Exemplo:

- Segunda-feira: uma demanda é iniciada e recebe um registro de execução.
- Terça-feira: a demanda continua pendente, mas nenhum trabalho é realizado.
- Quarta-feira: a demanda recebe um novo registro de execução e é concluída.

Contabilização:

- Segunda-feira: contabilizar a atividade.
- Terça-feira: não contabilizar como atividade executada.
- Quarta-feira: contabilizar novamente, pois houve uma nova execução e conclusão.

Regras:

- Uma atividade deve ser contabilizada nos dias em que houver trabalho efetivamente registrado.
- Uma demanda pendente não deve ser contabilizada automaticamente todos os dias.
- Uma conclusão realizada em outro dia deve gerar um registro de execução nesse dia.
- Se uma atividade for iniciada e concluída no mesmo dia, deve ser contabilizada apenas uma vez no total diário.
- Uma atividade pode aparecer em relatórios de diferentes dias quando houver registros reais de execução em cada um deles.
- Demandas antigas ainda pendentes podem aparecer nos pontos de atenção, mas não devem ser contabilizadas como trabalho executado no dia.

Para implementar essa lógica, separar os dados da demanda dos registros de execução.

## 5. Estrutura do banco de dados

Utilizar Prisma ORM com SQLite.

Criar inicialmente os seguintes modelos:

### Activity

Representa a demanda cadastrada.

Campos sugeridos:

- id
- title
- description
- category
- importance
- status
- createdAt
- startedAt
- dueDate
- completedAt
- updatedAt

### ActivityLog

Representa uma execução realizada em determinada data.

Campos sugeridos:

- id
- activityId
- executionDate
- description
- timeSpent (opcional)
- createdAt

Relacionamento:

Uma Activity pode possuir vários ActivityLogs.

Cada registro representa uma execução ou atualização de trabalho realizada em uma data específica.

### Report

Representa um relatório gerado.

Campos sugeridos:

- id
- referenceDate
- content
- pdfPath
- createdAt

Os modelos podem ser ajustados conforme a necessidade técnica, desde que as regras de negócio sejam preservadas.

Utilizar enums para prioridade e status, quando adequado.

## 6. Funcionamento dos registros de execução

Ao iniciar uma demanda, o sistema deverá registrar automaticamente sua data de início e criar o primeiro registro de execução.

O usuário também deverá conseguir adicionar novos registros manualmente em demandas que já estejam em andamento.

Ao concluir uma demanda:

- Atualizar o status para concluída.
- Registrar a data de conclusão.
- Criar um registro de execução referente à conclusão, caso ainda não exista um registro para essa atividade no dia.
- Evitar duplicidade na contabilização diária.

A contabilização do dashboard e dos relatórios deverá considerar atividades distintas com registros de execução na data selecionada.

Se houver mais de um registro da mesma atividade no mesmo dia, ela deverá contar apenas uma vez no indicador de atividades executadas.

## 7. Integração com Claude API

Criar um serviço específico no backend para comunicação com a Claude API.

Fluxo:

1. Usuário solicita a geração do relatório diário.
2. Backend consulta as demandas e os registros de execução referentes à data selecionada.
3. Backend também identifica demandas pendentes, atrasadas e em andamento.
4. Backend organiza os dados e envia para a Claude API.
5. Claude retorna o relatório estruturado.
6. Backend salva o relatório no banco.
7. Backend gera o PDF.
8. Frontend apresenta o relatório na tela de relatórios.

A IA deverá receber informações estruturadas e ter instruções explícitas para não inventar dados.

A integração deve ser modular, permitindo trocar o modelo de IA futuramente sem precisar modificar toda a aplicação.

## 8. Design e experiência do usuário

Criar uma interface moderna, profissional e minimalista.

Referências de estilo:

- Dashboard administrativo moderno.
- Interface limpa e organizada.
- Boa hierarquia visual.
- Cards para indicadores.
- Tabelas organizadas para demandas.
- Gráficos simples e informativos.
- Feedback visual para prioridades e status.
- Layout responsivo.

Evitar:

- Excesso de cores.
- Elementos decorativos desnecessários.
- Interface poluída.
- Formulários extensos.
- Informações redundantes.

A experiência deve priorizar agilidade e facilidade de utilização durante a rotina de trabalho.

## 9. Organização do projeto

Separar frontend e backend.

Estrutura sugerida:

```text
gerenciador-demandas/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── Demandas/
│   │   │   └── Relatorios/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── App.jsx
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   ├── utils/
│   │   └── server.js
│   ├── .env
│   └── package.json
│
└── README.md
```

## 10. Orientações de desenvolvimento

Não desenvolver tudo de uma só vez.

Quero construir o projeto por etapas, validando cada parte antes de avançar.

Ordem de desenvolvimento:

**Etapa 1 — Estrutura inicial**
- Criar frontend React com Vite.
- Criar backend Express.
- Configurar Prisma e SQLite.
- Configurar comunicação entre frontend e backend.
- Criar estrutura de navegação com as três telas.

**Etapa 2 — Gerenciamento de demandas**
- Implementar banco de dados.
- Criar CRUD de demandas.
- Implementar filtros.
- Implementar alteração de status.
- Criar registros de execução.
- Validar a regra de contabilização entre dias.

**Etapa 3 — Dashboard**
- Criar indicadores.
- Implementar consultas por período.
- Criar gráficos.
- Validar os números com os registros do banco.

**Etapa 4 — Relatórios**
- Implementar integração com Claude API.
- Criar geração de relatório diário.
- Salvar relatórios.
- Gerar PDFs.
- Implementar histórico e download.

**Etapa 5 — Refinamentos**
- Melhorar interface.
- Tratar erros.
- Melhorar experiência do usuário.
- Revisar regras de negócio.
- Preparar arquitetura para futuras funcionalidades.

## 11. Funcionalidades futuras (não implementar agora)

Deixar a arquitetura preparada para:

- Integração com Google Chat.
- Captura automática de demandas.
- Integração com Google Sheets.
- Geração automática de relatórios em horários programados.
- Relatórios semanais.
- Histórico de produtividade.
- Sugestões de priorização por IA.

Não implementar essas funcionalidades no MVP.

## 12. Primeira tarefa

Comece exclusivamente pela Etapa 1.

Antes de desenvolver:

1. Apresente a estrutura que será criada.
2. Explique brevemente as decisões técnicas.
3. Identifique as dependências necessárias.
4. Implemente a estrutura inicial do frontend e backend.
5. Configure a conexão com o banco SQLite utilizando Prisma.
6. Crie as três páginas iniciais com navegação funcional.

Não avance para o CRUD ou integração com IA ainda.

Ao finalizar, apresente os comandos necessários para executar o projeto e explique como validar se frontend, backend e banco estão funcionando corretamente.

Priorize código organizado, legível, reutilizável e fácil de manter.