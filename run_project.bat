@echo off
setlocal enableextensions enabledelayedexpansion
REM ==============================================
REM  Run Projeto_IA (Windows)
REM  - Sobe Postgres via Docker Compose (se houver)
REM  - Prepara venv Python e deps
REM  - Inicia API (Uvicorn) em nova janela
REM  - Inicia Frontend Vite em nova janela
REM ==============================================

pushd "%~dp0"

REM ----- [1/4] Banco (Docker) -----
where docker >nul 2>&1
if %ERRORLEVEL%==0 (
  docker compose version >nul 2>&1
  if %ERRORLEVEL%==0 (
    echo [DB] docker compose up -d
    docker compose -f docker-compose.yml up -d
  ) else (
    where docker-compose >nul 2>&1
    if %ERRORLEVEL%==0 (
      echo [DB] docker-compose up -d
      docker-compose -f docker-compose.yml up -d
    ) else (
      echo [DB] docker-compose nao encontrado. Pulando DB.
    )
  )
) else (
  echo [DB] Docker nao encontrado. Pulando DB.
)

REM ----- [2/4] Venv + deps -----
if not exist "venv\Scripts\python.exe" (
  echo [PY] Criando venv local...
  where py >nul 2>&1 && ( py -3 -m venv venv ) || ( python -m venv venv )
)

set "PY=%CD%\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo [PY] Instalando dependencias...
if exist "requirements.txt" (
  "%PY%" -m pip install -r requirements.txt
) else (
  echo [PY] requirements.txt nao encontrado, seguindo em frente.
)

REM Monta PYTHONPATH para janelas novas herdarem
set "PYTHONPATH=%CD%"

REM ----- [3/4] API -----
if exist "%CD%\venv\Scripts\python.exe" (
  echo [API] Iniciando Uvicorn em nova janela...
  start "Projeto_IA API" "%CD%\venv\Scripts\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
) else (
  echo [API] Iniciando com python do sistema...
  start "Projeto_IA API" python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
)

REM ----- [4/4] Frontend -----
if exist "adapte-estuda-planejador-main\package.json" (
  echo [WEB] Instalando deps e iniciando Vite em nova janela...
  if exist "adapte-estuda-planejador-main\package-lock.json" (
    start "Projeto_IA Web" cmd /k "cd /d adapte-estuda-planejador-main && npm ci && npm run dev"
  ) else (
    start "Projeto_IA Web" cmd /k "cd /d adapte-estuda-planejador-main && npm install && npm run dev"
  )
) else (
  echo [WEB] Pasta do frontend nao encontrada. Pulando frontend.
)

echo ==============================================
echo API:      http://localhost:8000/api/v1/health
echo Frontend:  http://localhost:8080
echo ==============================================

popd
endlocal
exit /b 0