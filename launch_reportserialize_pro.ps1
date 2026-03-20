$ErrorActionPreference = "Continue"
$WorkingDir = $PSScriptRoot
Set-Location $WorkingDir

# Ensure node_modules exists
if (-not (Test-Path "$WorkingDir\node_modules")) {
    npm install
}

# Close any existing node process listening on 3001
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
}

# Start Vite server
$viteProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -PassThru -WindowStyle Hidden

# Wait for Vite to be ready
$Retries = 0
$IsUp = $false
while (-not $IsUp -and $Retries -lt 30) {
    try {
        # Temporarily bypass proxy for health check
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:3001" -TimeoutSec 1 -ErrorAction Stop
        $IsUp = $true
    } catch {
        Start-Sleep -Seconds 1
        $Retries++
    }
}

if ($IsUp) {
    # Launch Edge in app mode with a dedicated profile to avoid icon caching issues. Disable proxy to prevent VPN interference.
    Start-Process -FilePath "msedge.exe" -ArgumentList "--no-proxy-server", "--app=http://127.0.0.1:3001/", "--window-size=1280,800", "--user-data-dir=$env:LOCALAPPDATA\ReportSerializeProApp", "--disable-features=msWebOOUI,msPdfOOUI,msEdgeMiniMenu" -PassThru
}

# The Vite backend process will stay alive in the background.
# When this script is run next time, it will automatically kill the old instance listening on 3001.

