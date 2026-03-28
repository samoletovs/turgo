<#
.SYNOPSIS
    Quick deploy using cloud-side Docker build (no local Docker needed).
    Builds image directly in Azure Container Registry, then updates the Container App.

.DESCRIPTION
    This is MUCH faster than the standard deploy because:
    - No local Docker build (offloaded to ACR)
    - No docker push step (image is already in ACR)
    - Total time: ~2-4 minutes vs ~8-15 minutes

    Usage:  .\deploy-quick.ps1              # Cloud build + deploy
            .\deploy-quick.ps1 -Migrate     # Also run prisma migrate
            .\deploy-quick.ps1 -BuildOnly   # Build in ACR but don't deploy

.NOTES
    Prerequisites:
    - Azure CLI installed & logged in (az login)
    - NO Docker Desktop needed!
#>

param(
    [switch]$Migrate,
    [switch]$Seed,
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

# ── Configuration ──
$PROJECT        = "turgo"
$RESOURCE_GROUP = "rg-turgo"

Write-Host "`n=== Turgo Quick Deploy (Cloud Build) ===" -ForegroundColor Cyan
$totalStart = Get-Date

# ── Auto-detect ACR ──
Write-Host "Fetching ACR info from Azure..." -ForegroundColor Gray
$ACR_NAME = az acr list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv
if (-not $ACR_NAME) {
    Write-Host "ERROR: No ACR found in $RESOURCE_GROUP. Run infra/azure-setup.sh first." -ForegroundColor Red
    exit 1
}
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query "loginServer" -o tsv
$IMAGE = "${ACR_LOGIN_SERVER}/${PROJECT}:latest"
$TIMESTAMP_TAG = "${ACR_LOGIN_SERVER}/${PROJECT}:$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "  ACR:   $ACR_LOGIN_SERVER" -ForegroundColor Gray
Write-Host "  Image: $IMAGE" -ForegroundColor Gray

# ── Step 1: Cloud Build in ACR ──
Write-Host "`n[1/2] Building image in Azure (cloud build)..." -ForegroundColor Yellow
Write-Host "  No local Docker needed — ACR builds it for you" -ForegroundColor Gray
$buildStart = Get-Date

az acr build `
    --registry $ACR_NAME `
    --image "${PROJECT}:latest" `
    --image "${PROJECT}:$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
    --file Dockerfile `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cloud build failed." -ForegroundColor Red
    exit 1
}
$buildTime = [math]::Round(((Get-Date) - $buildStart).TotalSeconds)
Write-Host "  Cloud build completed in ${buildTime}s" -ForegroundColor Green

if ($BuildOnly) {
    Write-Host "`nBuild-only mode — skipping deployment." -ForegroundColor Yellow
    Write-Host "Image available: $IMAGE" -ForegroundColor Cyan
    exit 0
}

# ── Step 2: Update Container App ──
Write-Host "`n[2/2] Deploying to Azure Container Apps..." -ForegroundColor Yellow
$deployStart = Get-Date

az containerapp update `
    --resource-group $RESOURCE_GROUP `
    --name $PROJECT `
    --image $IMAGE `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Container App update failed." -ForegroundColor Red
    exit 1
}
$deployTime = [math]::Round(((Get-Date) - $deployStart).TotalSeconds)
Write-Host "  Deploy completed in ${deployTime}s" -ForegroundColor Green

# ── Optional: Run migrations ──
if ($Migrate) {
    Write-Host "`nRunning database migrations..." -ForegroundColor Yellow
    az containerapp exec `
        --resource-group $RESOURCE_GROUP `
        --name $PROJECT `
        --command "npx prisma migrate deploy"
}

# ── Optional: Seed database ──
if ($Seed) {
    Write-Host "`nSeeding database..." -ForegroundColor Yellow
    az containerapp exec `
        --resource-group $RESOURCE_GROUP `
        --name $PROJECT `
        --command "npx prisma db seed"
}

# ── Done ──
$totalTime = [math]::Round(((Get-Date) - $totalStart).TotalSeconds)
$APP_URL = az containerapp show --resource-group $RESOURCE_GROUP --name $PROJECT --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "`n=== Quick Deploy Complete ($totalTime`s total) ===" -ForegroundColor Green
Write-Host "URL: https://$APP_URL" -ForegroundColor Cyan
Write-Host ""
