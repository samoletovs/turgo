<#
.SYNOPSIS
    Deploy Turgo directly from local machine to Azure Container Apps.
    Skips GitHub Actions — build image locally, push to ACR, update container.

.DESCRIPTION
    Usage:  .\deploy.ps1
            .\deploy.ps1 -SkipBuild        # re-deploy existing :latest image
            .\deploy.ps1 -Migrate           # also run prisma migrate deploy
            .\deploy.ps1 -Seed              # also run prisma db seed

.NOTES
    Prerequisites:
    - Azure CLI installed & logged in (az login)
    - Docker Desktop running
#>

param(
    [switch]$SkipBuild,
    [switch]$Migrate,
    [switch]$Seed
)

$ErrorActionPreference = "Stop"

# ── Configuration ──
$PROJECT        = "turgo"
$RESOURCE_GROUP = "rg-turgo"

# Auto-detect ACR name from Azure
Write-Host "`n=== Turgo Local Deploy ===" -ForegroundColor Cyan

Write-Host "Fetching ACR info from Azure..." -ForegroundColor Gray
$ACR_NAME = az acr list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv
if (-not $ACR_NAME) {
    Write-Host "ERROR: No ACR found in $RESOURCE_GROUP. Run infra/azure-setup.sh first." -ForegroundColor Red
    exit 1
}
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query "loginServer" -o tsv
$IMAGE = "${ACR_LOGIN_SERVER}/${PROJECT}:latest"

Write-Host "  ACR:   $ACR_LOGIN_SERVER" -ForegroundColor Gray
Write-Host "  Image: $IMAGE" -ForegroundColor Gray

if (-not $SkipBuild) {
    # ── Step 1: Login to ACR ──
    Write-Host "`n[1/3] Logging into Azure Container Registry..." -ForegroundColor Yellow
    az acr login --name $ACR_NAME
    if ($LASTEXITCODE -ne 0) { exit 1 }

    # ── Step 2: Build Docker image ──
    Write-Host "`n[2/3] Building Docker image..." -ForegroundColor Yellow
    $buildStart = Get-Date
    docker build -t $IMAGE .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker build failed." -ForegroundColor Red
        exit 1
    }
    $buildTime = [math]::Round(((Get-Date) - $buildStart).TotalSeconds)
    Write-Host "  Build completed in ${buildTime}s" -ForegroundColor Green

    # ── Step 3: Push to ACR ──
    Write-Host "`n[3/3] Pushing image to ACR..." -ForegroundColor Yellow
    $pushStart = Get-Date
    docker push $IMAGE
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker push failed." -ForegroundColor Red
        exit 1
    }
    $pushTime = [math]::Round(((Get-Date) - $pushStart).TotalSeconds)
    Write-Host "  Push completed in ${pushTime}s" -ForegroundColor Green
} else {
    Write-Host "`nSkipping build — deploying existing :latest image" -ForegroundColor Yellow
}

# ── Step 4: Update Container App ──
Write-Host "`nDeploying to Azure Container Apps..." -ForegroundColor Yellow
az containerapp update `
    --resource-group $RESOURCE_GROUP `
    --name $PROJECT `
    --image $IMAGE `
    --output none
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Container App update failed." -ForegroundColor Red
    exit 1
}
Write-Host "  Container App updated!" -ForegroundColor Green

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
$APP_URL = az containerapp show --resource-group $RESOURCE_GROUP --name $PROJECT --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "`n=== Deploy Complete ===" -ForegroundColor Green
Write-Host "URL: https://$APP_URL" -ForegroundColor Cyan
Write-Host ""
