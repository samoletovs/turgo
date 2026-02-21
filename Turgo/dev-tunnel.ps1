<#
.SYNOPSIS
    Run Next.js dev server locally and expose it via Azure Dev Tunnels.
    Gives you a public URL to test changes INSTANTLY — no Docker, no deploy.

.DESCRIPTION
    Usage:  .\dev-tunnel.ps1                # Start dev server + tunnel
            .\dev-tunnel.ps1 -Port 3001     # Use a custom port
            .\dev-tunnel.ps1 -NoBrowser     # Don't auto-open browser

.NOTES
    Prerequisites:
    - Node.js installed
    - Azure Dev Tunnels CLI: winget install Microsoft.devtunnel
      OR: npm install -g @vs/tunnels-cli
    - Run `devtunnel user login` once before first use
#>

param(
    [int]$Port = 3000,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Turgo Dev Tunnel ===" -ForegroundColor Cyan
Write-Host "Hot-reload dev server with public URL" -ForegroundColor Gray

# ── Check prerequisites ──
$devtunnelCmd = Get-Command devtunnel -ErrorAction SilentlyContinue
if (-not $devtunnelCmd) {
    Write-Host "`ndevtunnel CLI not found. Installing..." -ForegroundColor Yellow
    Write-Host "  winget install Microsoft.devtunnel" -ForegroundColor Gray
    winget install Microsoft.devtunnel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install devtunnel. Install manually:" -ForegroundColor Red
        Write-Host "  winget install Microsoft.devtunnel" -ForegroundColor Gray
        Write-Host "  OR: https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started" -ForegroundColor Gray
        exit 1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ── Check devtunnel login ──
$loginCheck = devtunnel user show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nYou need to login to Dev Tunnels first:" -ForegroundColor Yellow
    devtunnel user login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Login failed." -ForegroundColor Red
        exit 1
    }
}

# ── Start Next.js dev server in background ──
Write-Host "`n[1/2] Starting Next.js dev server on port $Port..." -ForegroundColor Yellow
$devJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    $env:PORT = $port
    npm run dev
} -ArgumentList (Get-Location).Path, $Port

# Wait for dev server to be ready
Write-Host "  Waiting for dev server..." -ForegroundColor Gray
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -ge 200) {
            Write-Host "  Dev server ready!" -ForegroundColor Green
            break
        }
    } catch {
        # Not ready yet
    }
    Write-Host "  ..." -ForegroundColor Gray
}
if ($waited -ge $maxWait) {
    Write-Host "  WARNING: Dev server may not be ready yet, continuing..." -ForegroundColor Yellow
}

# ── Start Dev Tunnel ──
Write-Host "`n[2/2] Creating dev tunnel..." -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop both the tunnel and dev server.`n" -ForegroundColor Gray

try {
    if ($NoBrowser) {
        devtunnel host -p $Port --allow-anonymous
    } else {
        devtunnel host -p $Port --allow-anonymous
    }
} finally {
    # Cleanup: stop the dev server job
    Write-Host "`nShutting down dev server..." -ForegroundColor Yellow
    Stop-Job -Job $devJob -ErrorAction SilentlyContinue
    Remove-Job -Job $devJob -Force -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
