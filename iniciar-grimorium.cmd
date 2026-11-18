@echo off
rem Inicia o Grimorium no Windows: dois cliques neste arquivo (ou no atalho da Area de Trabalho).
rem A preparacao (Node, .env, dependencias, banco) fica em scripts\preflight.mjs, executado pelo "npm start".
chcp 65001 >nul
title Grimorium
cd /d "%~dp0"

rem Se ja estiver rodando, apenas abre o navegador (evita subir uma segunda copia).
curl -s -o nul -f --max-time 2 http://localhost:3333/api/health
if %errorlevel%==0 (
  echo O Grimorium já está em execução. Abrindo no navegador...
  start "" http://localhost:5173
  timeout /t 2 /nobreak >nul
  exit /b 0
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm não encontrado. Instale o Node.js LTS em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)

echo.
echo   Invocando o Grimorium...
echo   Na primeira vez, as dependências são instaladas, o que pode levar alguns minutos.
echo   O navegador abre sozinho quando estiver pronto.
echo   Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.
call npm start

rem Mantém a janela aberta para ler eventuais mensagens de erro.
echo.
echo O Grimorium foi encerrado. Se apareceu algum erro acima, leia a mensagem antes de fechar.
pause
