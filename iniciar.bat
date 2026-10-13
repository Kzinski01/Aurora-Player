@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo   Aurora - YouTube Downloader ^& Converter
echo ============================================
echo.

if not exist "node_modules" (
    echo [1/3] Instalando dependencias do aplicativo...
    call npm ci
    if errorlevel 1 goto :erro
) else (
    echo [1/3] Dependencias do aplicativo ja instaladas.
)

if not exist "src\renderer\node_modules" (
    echo [2/3] Instalando dependencias do frontend...
    call npm --prefix src\renderer ci
    if errorlevel 1 goto :erro
) else (
    echo [2/3] Dependencias do frontend ja instaladas.
)

echo [3/3] Compilando o frontend...
call npm run prepare:binaries
if errorlevel 1 goto :erro
call npm run build:renderer
if errorlevel 1 goto :erro

echo.
echo Iniciando o Aurora...
echo.
call npm start

goto :fim

:erro
echo.
echo Ocorreu um erro durante a preparacao do aplicativo.
pause
exit /b 1

:fim
pause
