@echo off
chcp 65001 >nul
echo [Antigravity] Launching ReportSerialize GUI...
pushd "%~dp0"
cd ..\..\..

if not exist "node_modules\" (
    echo [Antigravity] Missing node_modules, installing dependencies...
    cmd /c npm install
)

echo [Antigravity] Starting Dev Server on http://localhost:3000...
start http://localhost:3000
npm run dev
popd
