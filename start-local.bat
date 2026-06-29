@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
cd /d "%ROOT%"
if "%LUMITIME_POSTGRES_PORT%"=="" set "LUMITIME_POSTGRES_PORT=15432"

if /I "%~1"=="backend" goto backend
if /I "%~1"=="frontend" goto frontend
if /I "%~1"=="postgres-start" goto postgres_start
if /I "%~1"=="status" goto status
if /I "%~1"=="stop" goto stop
if /I "%~1"=="help" goto usage
if /I "%~1"=="-h" goto usage
if /I "%~1"=="/?" goto usage

set "MODE=%~1"
if "%MODE%"=="" goto menu
if /I "%MODE%"=="sqlite" goto launch
if /I "%MODE%"=="postgres" goto launch

echo Unknown mode "%MODE%".
goto usage

:menu
echo.
echo Lumitime local launcher
echo.
echo   1. SQLite      - fast local development
echo   2. PostgreSQL  - production-like local database
echo.
set /p "CHOICE=Choose mode [1/2, default 1]: "
if "%CHOICE%"=="" set "CHOICE=1"
if "%CHOICE%"=="1" (
  set "MODE=sqlite"
  goto launch
)
if "%CHOICE%"=="2" (
  set "MODE=postgres"
  goto launch
)

echo Invalid choice.
exit /b 1

:launch
if /I "%MODE%"=="postgres" (
  echo.
  choice /C YN /N /M "Start Docker PostgreSQL container if needed? [Y/N] "
  if errorlevel 2 (
    echo Skipping Docker PostgreSQL startup.
  ) else (
    call "%~f0" postgres-start
    if errorlevel 1 (
      echo.
      echo PostgreSQL container startup failed. Continuing assumes PostgreSQL is already available.
      pause
    )
  )
)

call :health_check 8000
if not errorlevel 1 (
  echo.
  echo Backend is already running on port 8000.
  choice /C YN /N /M "Stop current backend and start %MODE% mode? [Y/N] "
  if errorlevel 2 (
    echo Keeping existing backend.
    goto maybe_frontend
  )
  call :stop_port 8000
)

echo.
echo Starting Lumitime backend in %MODE% mode...
start "Lumitime Backend (%MODE%)" /D "%ROOT%" cmd /k ""%~f0" backend %MODE%"

timeout /t 2 /nobreak >nul

:maybe_frontend
echo Starting Lumitime frontend...
start "Lumitime Frontend" /D "%ROOT%frontend" cmd /k ""%~f0" frontend"

echo.
echo Local URLs:
echo   Frontend: http://localhost:5173
echo   Backend:  http://127.0.0.1:8000/api/v1/health
echo.
exit /b 0

:backend
set "MODE=%~2"
if "%MODE%"=="" set "MODE=sqlite"

if /I "%MODE%"=="sqlite" (
  set "LUMITIME_DATABASE_URL=sqlite:///./backend/lumitime.db"
) else if /I "%MODE%"=="postgres" (
  set "LUMITIME_DATABASE_URL=postgresql+psycopg://lumitime:lumitime@127.0.0.1:%LUMITIME_POSTGRES_PORT%/lumitime"
) else (
  echo Unknown backend mode "%MODE%".
  exit /b 1
)

set "LUMITIME_ENV=development"
set "LUMITIME_UPLOAD_DIR=backend/uploads"
set "LUMITIME_BOOTSTRAP_DEMO_DATA=1"
set "LUMITIME_ENABLE_INLINE_WORKER=1"
set "LUMITIME_AUTO_MIGRATE=1"
set "LUMITIME_REQUIRE_MIGRATED_DB=1"

call :health_check 8000
if not errorlevel 1 (
  echo Backend is already running at http://127.0.0.1:8000/api/v1/health.
  echo Press Ctrl+C if you want to close this window.
  pause >nul
  exit /b 0
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found in PATH.
  echo Install Python 3.11+, then run:
  echo   python -m pip install -r backend\requirements.txt pytest httpx
  exit /b 1
)

python -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo Backend dependencies are missing.
  echo Run this first:
  echo   python -m pip install -r backend\requirements.txt pytest httpx
  exit /b 1
)

echo Backend mode: %MODE%
echo Database: %LUMITIME_DATABASE_URL%
echo.
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
exit /b %ERRORLEVEL%

:frontend
cd /d "%ROOT%frontend"

call :health_check 5173
if not errorlevel 1 (
  echo Frontend is already running at http://127.0.0.1:5173.
  echo Press Ctrl+C if you want to close this window.
  pause >nul
  exit /b 0
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found in PATH.
  echo Run this first:
  echo   corepack enable
  echo   pnpm install --frozen-lockfile
  exit /b 1
)

if not exist node_modules (
  echo frontend\node_modules was not found.
  choice /C YN /N /M "Run pnpm install --frozen-lockfile now? [Y/N] "
  if errorlevel 2 (
    echo Install skipped. Run pnpm install --frozen-lockfile manually.
    exit /b 1
  )
  pnpm install --frozen-lockfile
  if errorlevel 1 exit /b %ERRORLEVEL%
)

pnpm dev
exit /b %ERRORLEVEL%

:status
echo.
echo Lumitime local status
call :health_check 8000
if errorlevel 1 (
  echo   Backend:  not reachable at http://127.0.0.1:8000/api/v1/health
) else (
  echo   Backend:  OK http://127.0.0.1:8000/api/v1/health
)
call :health_check 5173
if errorlevel 1 (
  echo   Frontend: not reachable at http://127.0.0.1:5173
) else (
  echo   Frontend: OK http://127.0.0.1:5173
)
exit /b 0

:stop
echo.
echo Stopping local Lumitime processes on ports 8000 and 5173...
call :stop_port 8000
call :stop_port 5173
exit /b %ERRORLEVEL%

:postgres_start
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found in PATH.
  exit /b 1
)

docker inspect lumitime-postgres >nul 2>nul
if errorlevel 1 (
  echo Creating lumitime-postgres container...
  docker run --name lumitime-postgres -e POSTGRES_DB=lumitime -e POSTGRES_USER=lumitime -e POSTGRES_PASSWORD=lumitime -p %LUMITIME_POSTGRES_PORT%:5432 -v lumitime-postgres-data:/var/lib/postgresql/data -d postgres:16-alpine
  if errorlevel 1 exit /b %ERRORLEVEL%
  call :wait_postgres
  exit /b %ERRORLEVEL%
)

docker ps --filter "name=lumitime-postgres" --filter "status=running" --format "{{.Names}}" | findstr /I /C:"lumitime-postgres" >nul
if errorlevel 1 (
  echo Starting existing lumitime-postgres container...
  docker start lumitime-postgres
  if errorlevel 1 exit /b %ERRORLEVEL%
  call :wait_postgres
  exit /b %ERRORLEVEL%
)

echo lumitime-postgres is already running.
call :wait_postgres
exit /b 0

:usage
echo.
echo Usage:
echo   start-local.bat
echo   start-local.bat sqlite
echo   start-local.bat postgres
echo   start-local.bat status
echo   start-local.bat stop
echo.
echo Internal commands:
echo   start-local.bat backend sqlite
echo   start-local.bat backend postgres
echo   start-local.bat frontend
echo   start-local.bat postgres-start
echo.
exit /b 1

:health_check
curl.exe -fsS --max-time 2 "http://127.0.0.1:%~1/api/v1/health" >nul 2>nul
exit /b %ERRORLEVEL%

:stop_port
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=%~1; $processIds=(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); foreach($processId in $processIds){ try { $proc=Get-Process -Id $processId -ErrorAction Stop; Write-Host ('Stopping port {0}: PID {1} {2}' -f $port,$processId,$proc.ProcessName); Stop-Process -Id $processId -Force } catch {} }"
exit /b %ERRORLEVEL%

:wait_postgres
echo Waiting for lumitime-postgres on host port %LUMITIME_POSTGRES_PORT%...
for /L %%i in (1,1,30) do (
  docker exec lumitime-postgres pg_isready -U lumitime -d lumitime >nul 2>nul
  if not errorlevel 1 (
    echo PostgreSQL is ready at 127.0.0.1:%LUMITIME_POSTGRES_PORT%.
    exit /b 0
  )
  powershell -NoProfile -Command "Start-Sleep -Seconds 1" >nul 2>nul
)
echo PostgreSQL did not become ready in time.
exit /b 1
