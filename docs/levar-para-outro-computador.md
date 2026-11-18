# Levar o Grimorium para outro computador

O Grimorium guarda tudo localmente, sem nuvem. Para usar seus dados em outra máquina, escolha o caminho que combina com a sua situação:

| Situação | Caminho |
|---|---|
| O outro computador **ainda não usa** o Grimorium (ou pode ter os dados substituídos) | **A — Mudança completa** (leva tudo: demandas, contatos, registros, Biblioteca, anexos e configurações) |
| O outro computador **já tem dados** no Grimorium e você quer **juntar** as informações | **B — Exportar e importar** (leva demandas, contatos e registros; não leva a Biblioteca) |

---

## O que fica onde

| Arquivo/pasta (dentro da pasta do Grimorium) | Conteúdo |
|---|---|
| `backend/prisma/dev.db` | o banco de dados: demandas, contatos, registros, Biblioteca, relatórios |
| `backend/storage/` | os anexos da Biblioteca |
| `backend/.env` | configurações e chaves (Claude, GitHub) |
| `node_modules/` (em várias pastas) | dependências — **não copie**, são reinstaladas sozinhas |

---

## A — Mudança completa

### No computador de origem

1. **Feche o Grimorium**: feche a janela do terminal “Grimorium” (ou pare o `npm run dev`). Copiar o banco com o sistema aberto pode gerar uma cópia incompleta.
2. Abra a pasta do Grimorium (ex.: `Área de Trabalho\grimorium`).
3. Copie a pasta inteira para um pendrive, HD externo ou nuvem pessoal (OneDrive, Google Drive…), **sem as pastas `node_modules`** — elas são grandes e são reinstaladas no outro PC.

   Para copiar já sem elas, abra o **Terminal do Windows** e rode (ajuste o destino `E:\grimorium`):

   ```powershell
   robocopy "$env:USERPROFILE\Desktop\grimorium" "E:\grimorium" /E /XD node_modules dist storage-test
   ```

   Confira que a cópia contém `backend\prisma\dev.db`, a pasta `backend\storage` (se você usa anexos) e `backend\.env`.

> **Atenção:** `backend/.env` pode conter suas chaves (Claude, GitHub). Guarde a cópia em local seguro e não a compartilhe.

### No computador de destino

1. Instale o **Node.js** (versão LTS) em [nodejs.org](https://nodejs.org), se ainda não tiver.
2. Cole a pasta `grimorium` onde preferir (ex.: na Área de Trabalho).
3. Dê dois cliques em **`iniciar-grimorium.cmd`**. Na primeira vez ele:
   - instala as dependências (alguns minutos);
   - atualiza o banco copiado, se esta versão do Grimorium tiver mudanças novas — **sem apagar dados**;
   - abre o Grimorium no navegador.
4. Confira se suas demandas, a Biblioteca e os anexos aparecem.
5. (Opcional) Crie o atalho na Área de Trabalho: botão direito em `iniciar-grimorium.cmd` → **Mostrar mais opções → Enviar para → Área de trabalho (criar atalho)**. Em **Propriedades → Alterar ícone**, escolha `assets\grimorium.ico`.

Depois de conferir que está tudo certo no novo computador, você pode apagar a cópia do pendrive/nuvem (ou mantê-la como backup).

### Se o destino já tinha o Grimorium instalado (e você quer substituir os dados)

1. Feche o Grimorium no destino.
2. **Guarde o banco atual do destino**, por segurança: renomeie `backend\prisma\dev.db` para `dev.db.antigo` (e a pasta `backend\storage` para `storage.antigo`).
3. Copie `dev.db` e a pasta `storage` da origem para os mesmos lugares.
4. Abra pelo `iniciar-grimorium.cmd`.

   Se a origem estiver com uma versão mais nova do Grimorium que o destino, substitua a pasta inteira em vez de só o banco (passo a passo do início desta seção).

> Copiar o `dev.db` **substitui todos os dados** do destino. Para juntar dados das duas máquinas, use o caminho B.

---

## B — Exportar e importar (juntar dados)

Leva **demandas, contatos e registros de execução**. A Biblioteca ainda não faz parte desse backup.

1. **Na origem:** Demandas → **Exportar / Importar** → em “O que exportar”, escolha **Por período → Tudo** → formato **Backup completo (JSON)** → **Baixar arquivo**.
2. Leve o arquivo `grimorium-backup-….json` para o outro computador (pendrive, e-mail, nuvem).
3. **No destino:** Demandas → **Exportar / Importar** → **Importar backup** → escolha o arquivo → **Importar**.
4. Confira o resumo (“X importadas · Y já existiam · Z com erro”). Itens que já existem no destino são ignorados, então importar de novo não duplica nada.

Para levar entradas da Biblioteca nesse cenário, por enquanto, use **Copiar como Markdown** em cada entrada e crie-a no destino (anexos precisam ser reenviados).

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| “Node.js/npm não encontrado” | Instale o Node.js e abra o `iniciar-grimorium.cmd` de novo. |
| A instalação falha no meio | Verifique a internet e abra o `iniciar-grimorium.cmd` de novo; ele retoma a instalação. |
| Grimorium abre vazio | O `dev.db` não foi copiado para `backend\prisma\` (ou o Grimorium criou um banco novo antes da cópia). Feche, coloque o `dev.db` da origem no lugar e abra de novo. |
| Erros ao abrir depois de copiar só o `dev.db` | O banco pode ter vindo de uma versão **mais nova** do Grimorium que a instalada no destino. Prefira sempre copiar a **pasta inteira** da origem (código + banco juntos), como no caminho A. |
| Anexos da Biblioteca não abrem | A pasta `backend\storage` não foi copiada junto com o `dev.db`. |
