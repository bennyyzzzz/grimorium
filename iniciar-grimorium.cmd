@echo off
rem Inicia o Grimorium (backend + frontend) e abre o navegador quando estiver pronto.
rem Uso: dois cliques neste arquivo (ou no atalho da Area de Trabalho).
rem No primeiro uso, instala as dependencias sozinho. A cada abertura, aplica migracoes pendentes do banco.
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
  echo Node.js/npm não encontrado. Instale o Node.js em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)

rem Configuração do backend: cria o .env a partir do modelo, se ainda não existir.
if not exist "backend\.env" (
  echo Criando backend\.env a partir do modelo...
  copy "backend\.env.example" "backend\.env" >nul
)

rem Primeiro uso (ou dependências apagadas): instala tudo.
set NEEDS_SETUP=0
if not exist "node_modules" set NEEDS_SETUP=1
if not exist "backend\node_modules" set NEEDS_SETUP=1
if not exist "frontend\node_modules" set NEEDS_SETUP=1

if "%NEEDS_SETUP%"=="1" (
  echo.
  echo   Primeira execução: instalando as dependências. Isso pode levar alguns minutos...
  echo.
  call npm run setup
  if errorlevel 1 goto :falha
) else (
  rem Aplica migrações novas do banco, se houver. Nunca apaga dados.
  call npm run prisma:deploy --prefix backend --silent >nul 2>&1
  if errorlevel 1 (
    echo Falha ao atualizar o banco de dados. Detalhes:
    call npm run prisma:deploy --prefix backend
    goto :falha
  )
)

echo.
echo   Invocando o Grimorium...
echo   O navegador abre sozinho quando estiver pronto.
echo   Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.
call npm run start:local

rem Se os servidores pararem por erro, mantém a janela aberta para ler a mensagem.
echo.
echo O Grimorium foi encerrado.
pause
exit /b 0

:falha
echo.
echo Não foi possível iniciar o Grimorium. Leia a mensagem acima.
pause
exit /b 1
