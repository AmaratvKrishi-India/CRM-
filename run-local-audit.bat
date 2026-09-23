@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem One-click local audit runner for the tools that require a target, service,
rem credentials, or a running device. It never targets production.
rem Set RUN_STRIX=1 before launching if you also want a bounded Strix scan.

cd /d "%~dp0"
set "ROOT=%~dp0"
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "RUN_ID=%%T"
set "REPORT_DIR=%ROOT%test-results\manual-audit\%RUN_ID%"
set "RUN_LOG=%REPORT_DIR%\run.log"
set "SUMMARY=%REPORT_DIR%\AUDIT-SUMMARY.md"
set "FAILURES="
set "PREVIEW_READY=0"
set "PREVIEW_STARTED=0"
if not defined RUN_STRIX set "RUN_STRIX=0"

if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"
>"%SUMMARY%" echo # Local audit summary
>>"%SUMMARY%" echo.
>>"%SUMMARY%" echo - Run ID: `%RUN_ID%`
>>"%SUMMARY%" echo - Project: `%ROOT%`
>>"%SUMMARY%" echo - Started: %DATE% %TIME%
>>"%SUMMARY%" echo - Safety scope: local preview, local Android, local Supabase, and local project files only
>"%RUN_LOG%" echo Local audit run %RUN_ID%

set "COMMAND=npm run verify:toolchain"
call :run "Toolchain preflight"
set "COMMAND=npm run typecheck"
call :run "TypeScript typecheck"
set "COMMAND=npm run lint"
call :run "ESLint"
set "COMMAND=npm run audit:fallow"
call :run "Fallow health"
set "COMMAND=npm run audit:fallow:security"
call :run "Fallow security candidates"
set "COMMAND=npm run audit:mobsf:status"
call :run "MobSF status"

call :ensure_preview
if "%PREVIEW_READY%"=="1" (
  set "COMMAND=C:\Users\PC\Tools\SecurityAudit\zap.cmd -cmd -quickurl http://127.0.0.1:4174 -quickout test-results\manual-audit\%RUN_ID%\zap-report.html"
  call :run "ZAP local baseline"
  set "COMMAND=npx --no-install autocannon -c 10 -d 30 http://127.0.0.1:4174/"
  call :run "Autocannon smoke load"
  set "COMMAND=npx --no-install artillery quick --count 10 --num 5 http://127.0.0.1:4174/"
  call :run "Artillery smoke load"
  set "K6_BIN=C:\ProgramData\chocolatey\bin\k6.exe"
  if not exist "!K6_BIN!" set "K6_BIN=k6"
  set "COMMAND=!K6_BIN! run --vus 10 --duration 30s -e TARGET_URL=http://127.0.0.1:4174/ --summary-export test-results\manual-audit\%RUN_ID%\k6-summary.json scripts\k6-smoke.js"
  call :run "k6 smoke load"
) else (
  >>"%SUMMARY%" echo - ZAP/load tools: **SKIPPED** because the local preview server did not become ready.
)

call :ensure_maestro_credentials
if "%MAESTRO_READY%"=="1" (
  set "COMMAND=npx --no-install tsx scripts/run-maestro.ts"
  call :run "Maestro Android suite"
) else (
  >>"%SUMMARY%" echo - Maestro: **SKIPPED** because local credentials were not supplied.
)

set "SNYK_BIN=%ROOT%node_modules\.bin\snyk.cmd"
if not exist "%SNYK_BIN%" set "SNYK_BIN=snyk"
where.exe snyk >nul 2>&1
if errorlevel 1 if not exist "%ROOT%node_modules\.bin\snyk.cmd" (
  >>"%SUMMARY%" echo - Snyk: **SKIPPED** because the CLI was not found.
) else (
  >>"%RUN_LOG%" echo.
  >>"%RUN_LOG%" echo ==== Snyk authentication status ====
  call "%SNYK_BIN%" whoami >>"%RUN_LOG%" 2>&1
  if errorlevel 1 (
    echo Snyk is not authenticated. Complete the browser login now.
    call "%SNYK_BIN%" auth >>"%RUN_LOG%" 2>&1
  )
  set "COMMAND=npx --no-install snyk test --all-projects --severity-threshold=high --json-file-output=test-results\manual-audit\%RUN_ID%\snyk.json"
  call :run "Snyk dependency scan"
)

if "%RUN_STRIX%"=="1" (
  set "COMMAND=C:\Users\PC\.local\bin\strix.exe --target . --scope-mode full --scan-mode quick --non-interactive --max-budget 5 --max-turns 100"
  call :run "Bounded Strix local scan"
) else (
  >>"%SUMMARY%" echo - Strix: **NOT RUN**. Set `RUN_STRIX=1` to include the bounded local scan.
)

>>"%SUMMARY%" echo.
>>"%SUMMARY%" echo ## Output files
>>"%SUMMARY%" echo - Raw combined log: `%RUN_LOG%`
>>"%SUMMARY%" echo - ZAP report: `%REPORT_DIR%\zap-report.html`
>>"%SUMMARY%" echo - Snyk JSON: `%REPORT_DIR%\snyk.json`
>>"%SUMMARY%" echo - k6 JSON: `%REPORT_DIR%\k6-summary.json`
>>"%SUMMARY%" echo - Maestro artifacts: `%ROOT%test-results\maestro`
>>"%SUMMARY%" echo.
>>"%SUMMARY%" echo Completed: %DATE% %TIME%
if "%PREVIEW_STARTED%"=="1" >>"%SUMMARY%" echo - The preview server was started by this run and may still be running on `http://127.0.0.1:4174`.
if defined FAILURES (
  >>"%SUMMARY%" echo - Commands requiring attention: !FAILURES!
  >>"%SUMMARY%" echo.
  >>"%SUMMARY%" echo This summary is complete, but one or more commands returned a non-zero exit code. Review `run.log`.
) else (
  >>"%SUMMARY%" echo - All selected commands returned exit code 0.
)

echo.
echo Audit complete. Report: "%SUMMARY%"
start "" notepad "%SUMMARY%"
if defined FAILURES exit /b 1
exit /b 0

:ensure_preview
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4174/' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  set "PREVIEW_READY=1"
  >>"%SUMMARY%" echo - Preview server: already available at `http://127.0.0.1:4174`.
  exit /b 0
)

set "COMMAND=npm run build"
call :run "Build for local preview"
if not "%LAST_RC%"=="0" (
  >>"%SUMMARY%" echo - Preview server: **NOT STARTED** because the build failed.
  exit /b 0
)
start "CRM Preview" /min /d "%ROOT%" cmd.exe /d /c npm run preview -- --host 127.0.0.1 --port 4174
set "PREVIEW_STARTED=1"
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4174/' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } } catch {}; Start-Sleep -Seconds 2 }; exit 1" >>"%RUN_LOG%" 2>&1
if errorlevel 1 (
  >>"%SUMMARY%" echo - Preview server: **FAILED TO START**. See `run.log`.
  exit /b 0
)
set "PREVIEW_READY=1"
>>"%SUMMARY%" echo - Preview server: started at `http://127.0.0.1:4174`.
exit /b 0

:ensure_maestro_credentials
set "MAESTRO_READY=1"
if not defined MAESTRO_AGENT_EMAIL set /p "MAESTRO_AGENT_EMAIL=Local Maestro agent email: "
if not defined MAESTRO_AGENT_PASSWORD set /p "MAESTRO_AGENT_PASSWORD=Local Maestro agent password: "
if not defined MAESTRO_ADMIN_EMAIL set /p "MAESTRO_ADMIN_EMAIL=Local Maestro admin email: "
if not defined MAESTRO_ADMIN_PASSWORD set /p "MAESTRO_ADMIN_PASSWORD=Local Maestro admin password: "
if not defined MAESTRO_PROVISIONED_AGENT_EMAIL set /p "MAESTRO_PROVISIONED_AGENT_EMAIL=Local provisioned-agent email: "
if not defined MAESTRO_PROVISIONED_AGENT_PASSWORD set /p "MAESTRO_PROVISIONED_AGENT_PASSWORD=Local provisioned-agent password: "
if not defined MAESTRO_AGENT_EMAIL set "MAESTRO_READY=0"
if not defined MAESTRO_AGENT_PASSWORD set "MAESTRO_READY=0"
if not defined MAESTRO_ADMIN_EMAIL set "MAESTRO_READY=0"
if not defined MAESTRO_ADMIN_PASSWORD set "MAESTRO_READY=0"
if not defined MAESTRO_PROVISIONED_AGENT_EMAIL set "MAESTRO_READY=0"
if not defined MAESTRO_PROVISIONED_AGENT_PASSWORD set "MAESTRO_READY=0"
if "%MAESTRO_READY%"=="1" >>"%SUMMARY%" echo - Maestro credentials: supplied for this process only; values were not written to disk.
exit /b 0

:run
set "LABEL=%~1"
>>"%RUN_LOG%" echo.
>>"%RUN_LOG%" echo ==== %LABEL% ====
call %COMMAND% >>"%RUN_LOG%" 2>&1
set "RC=%ERRORLEVEL%"
set "LAST_RC=%RC%"
>>"%SUMMARY%" echo - %LABEL%: exit code %RC%
if not "%RC%"=="0" set "FAILURES=!FAILURES!; %LABEL%"
exit /b 0
