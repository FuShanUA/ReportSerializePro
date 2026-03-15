$ErrorActionPreference = "Continue"
$WorkingDir = "D:\cc\Library\Tools\reportserialize-pro"
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
        $res = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $IsUp = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        $Retries++
    }
}

if ($IsUp) {
    # Launch Edge in app mode with a dedicated profile to avoid icon caching issues
    $edgeProcess = Start-Process -FilePath "msedge.exe" -ArgumentList "--app=http://localhost:3001/", "--window-size=1280,800", "--user-data-dir=$env:LOCALAPPDATA\ReportSerializeProApp" -PassThru
    # Wait for Edge to close
    Wait-Process -Id $edgeProcess.Id
}

# Cleanup Vite process
try {
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
    }
} catch {
}
