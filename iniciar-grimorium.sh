#!/usr/bin/env sh
# Inicia o Grimorium no Linux, WSL ou macOS:  sh iniciar-grimorium.sh
# A preparação (Node, .env, dependências, banco) fica em scripts/preflight.mjs, executado pelo "npm start".
cd "$(dirname "$0")" || exit 1

# Se já estiver rodando, apenas informa o endereço (evita subir uma segunda cópia).
if curl -s -o /dev/null -f --max-time 2 http://localhost:3333/api/health 2>/dev/null; then
  echo "O Grimorium já está em execução: http://localhost:5173"
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm não encontrado. Instale o Node.js LTS (ex.: nvm install --lts) e tente novamente."
  exit 1
fi

echo ""
echo "  Invocando o Grimorium..."
echo "  Na primeira vez, as dependências são instaladas, o que pode levar alguns minutos."
echo "  Acesse http://localhost:5173 quando estiver pronto. Para encerrar, pressione Ctrl+C."
echo ""
exec npm start
