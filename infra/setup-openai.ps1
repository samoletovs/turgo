# ──────────────────────────────────────────────────────────
# Azure OpenAI Setup for Turgo — Cost-Optimized
# ──────────────────────────────────────────────────────────
# Run: .\infra\setup-openai.ps1
# Prerequisites: Azure CLI installed and logged in (az login)
#
# Cost breakdown (pay-per-token, NO monthly base fee):
#   GPT-4o-mini:              $0.15/1M input, $0.60/1M output tokens
#   text-embedding-3-small:   $0.02/1M tokens
#   Estimated monthly cost:   $0.10-$2.00 for light/moderate usage
# ──────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

# ═══════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════
$PROJECT        = "turgo"
$LOCATION       = "swedencentral"        # Best Azure OpenAI model availability in Europe
$RESOURCE_GROUP = "rg-$PROJECT"
$OPENAI_NAME    = "oai-$PROJECT"
$SKU            = "S0"                   # Pay-per-use, no monthly base cost

# Model deployments — using cheapest capable models
$CHAT_MODEL           = "gpt-4o-mini"
$CHAT_DEPLOYMENT      = "gpt-4o-mini"
$CHAT_TPM             = 30              # 30K tokens/min — low to control costs
$CHAT_MODEL_VERSION   = "2024-07-18"

$EMBED_MODEL          = "text-embedding-3-small"
$EMBED_DEPLOYMENT     = "text-embedding-3-small"
$EMBED_TPM            = 30              # 30K tokens/min
$EMBED_MODEL_VERSION  = "1"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Azure OpenAI Setup — Cost-Optimized for Turgo          ║" -ForegroundColor Cyan
Write-Host "║  Resource Group: $RESOURCE_GROUP                         ║" -ForegroundColor Cyan
Write-Host "║  Location:       $LOCATION                       ║" -ForegroundColor Cyan
Write-Host "║  Chat Model:     $CHAT_MODEL (15x cheaper than GPT-4o)    ║" -ForegroundColor Cyan
Write-Host "║  Embed Model:    $EMBED_MODEL (5x cheaper)  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 0. Check Azure CLI login ──
Write-Host "▸ Checking Azure CLI login..." -ForegroundColor Yellow
try {
    $account = az account show 2>&1 | ConvertFrom-Json
    Write-Host "  Logged in as: $($account.user.name)" -ForegroundColor Green
    Write-Host "  Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
} catch {
    Write-Host "  Not logged in. Running 'az login'..." -ForegroundColor Red
    az login
}

# ── 1. Ensure Resource Group exists ──
Write-Host "▸ Ensuring Resource Group '$RESOURCE_GROUP' exists..." -ForegroundColor Yellow
$rgExists = az group exists --name $RESOURCE_GROUP 2>&1
if ($rgExists -eq "false") {
    Write-Host "  Creating Resource Group in $LOCATION..." -ForegroundColor Yellow
    az group create --name $RESOURCE_GROUP --location $LOCATION --output none
} else {
    Write-Host "  Resource Group already exists." -ForegroundColor Green
}

# ── 2. Create Azure OpenAI resource (Cognitive Services) ──
Write-Host "▸ Creating Azure OpenAI resource: $OPENAI_NAME..." -ForegroundColor Yellow
$existingResource = az cognitiveservices account show `
    --resource-group $RESOURCE_GROUP `
    --name $OPENAI_NAME 2>&1

if ($LASTEXITCODE -ne 0) {
    az cognitiveservices account create `
        --resource-group $RESOURCE_GROUP `
        --name $OPENAI_NAME `
        --location $LOCATION `
        --kind "OpenAI" `
        --sku $SKU `
        --custom-domain $OPENAI_NAME `
        --output none
    Write-Host "  Created Azure OpenAI resource." -ForegroundColor Green
} else {
    Write-Host "  Azure OpenAI resource already exists." -ForegroundColor Green
}

# ── 3. Deploy GPT-4o-mini (chat/vision) ──
Write-Host "▸ Deploying model: $CHAT_MODEL (${CHAT_TPM}K TPM)..." -ForegroundColor Yellow
$existingChat = az cognitiveservices account deployment show `
    --resource-group $RESOURCE_GROUP `
    --name $OPENAI_NAME `
    --deployment-name $CHAT_DEPLOYMENT 2>&1

if ($LASTEXITCODE -ne 0) {
    az cognitiveservices account deployment create `
        --resource-group $RESOURCE_GROUP `
        --name $OPENAI_NAME `
        --deployment-name $CHAT_DEPLOYMENT `
        --model-name $CHAT_MODEL `
        --model-version $CHAT_MODEL_VERSION `
        --model-format "OpenAI" `
        --sku-name "Standard" `
        --sku-capacity $CHAT_TPM `
        --output none
    Write-Host "  Deployed $CHAT_MODEL." -ForegroundColor Green
} else {
    Write-Host "  $CHAT_MODEL deployment already exists." -ForegroundColor Green
}

# ── 4. Deploy text-embedding-3-small ──
Write-Host "▸ Deploying model: $EMBED_MODEL (${EMBED_TPM}K TPM)..." -ForegroundColor Yellow
$existingEmbed = az cognitiveservices account deployment show `
    --resource-group $RESOURCE_GROUP `
    --name $OPENAI_NAME `
    --deployment-name $EMBED_DEPLOYMENT 2>&1

if ($LASTEXITCODE -ne 0) {
    az cognitiveservices account deployment create `
        --resource-group $RESOURCE_GROUP `
        --name $OPENAI_NAME `
        --deployment-name $EMBED_DEPLOYMENT `
        --model-name $EMBED_MODEL `
        --model-version $EMBED_MODEL_VERSION `
        --model-format "OpenAI" `
        --sku-name "Standard" `
        --sku-capacity $EMBED_TPM `
        --output none
    Write-Host "  Deployed $EMBED_MODEL." -ForegroundColor Green
} else {
    Write-Host "  $EMBED_MODEL deployment already exists." -ForegroundColor Green
}

# ── 5. Retrieve credentials ──
Write-Host "▸ Retrieving endpoint and API key..." -ForegroundColor Yellow

$ENDPOINT = az cognitiveservices account show `
    --resource-group $RESOURCE_GROUP `
    --name $OPENAI_NAME `
    --query "properties.endpoint" -o tsv

$API_KEY = az cognitiveservices account keys list `
    --resource-group $RESOURCE_GROUP `
    --name $OPENAI_NAME `
    --query "key1" -o tsv

# ── 6. Update .env file ──
Write-Host "▸ Updating .env file with Azure OpenAI credentials..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot ".." ".env"
$envPath = (Resolve-Path $envPath).Path

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw

    # Update AI_PROVIDER to azure
    $envContent = $envContent -replace 'AI_PROVIDER="[^"]*"', 'AI_PROVIDER="azure"'

    # Update Azure OpenAI credentials
    $envContent = $envContent -replace 'AZURE_OPENAI_API_KEY="[^"]*"', "AZURE_OPENAI_API_KEY=`"$API_KEY`""
    $envContent = $envContent -replace 'AZURE_OPENAI_ENDPOINT="[^"]*"', "AZURE_OPENAI_ENDPOINT=`"$ENDPOINT`""
    $envContent = $envContent -replace 'AZURE_OPENAI_DEPLOYMENT_NAME="[^"]*"', "AZURE_OPENAI_DEPLOYMENT_NAME=`"$CHAT_DEPLOYMENT`""

    # Add embedding and vision deployment if not present
    if ($envContent -notmatch "AZURE_OPENAI_EMBEDDING_DEPLOYMENT") {
        $envContent = $envContent -replace '(AZURE_OPENAI_DEPLOYMENT_NAME="[^"]*")',
            "`$1`nAZURE_OPENAI_EMBEDDING_DEPLOYMENT=`"$EMBED_DEPLOYMENT`"`nAZURE_OPENAI_VISION_DEPLOYMENT=`"$CHAT_DEPLOYMENT`"`nAZURE_OPENAI_API_VERSION=`"2024-12-01-preview`""
    }

    Set-Content -Path $envPath -Value $envContent.TrimEnd() -NoNewline
    Write-Host "  .env updated successfully." -ForegroundColor Green
} else {
    Write-Host "  WARNING: .env file not found at $envPath" -ForegroundColor Red
    Write-Host "  Add these manually:" -ForegroundColor Yellow
}

# ── 7. Output summary ──
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓  AZURE OPENAI CREATED SUCCESSFULLY                   ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoint:              $ENDPOINT" -ForegroundColor White
Write-Host "API Key:               $($API_KEY.Substring(0,8))****" -ForegroundColor White
Write-Host "Chat Deployment:       $CHAT_DEPLOYMENT" -ForegroundColor White
Write-Host "Embedding Deployment:  $EMBED_DEPLOYMENT" -ForegroundColor White
Write-Host ""
Write-Host "─── .env Variables Set ──────────────────────────────────" -ForegroundColor DarkGray
Write-Host "AI_PROVIDER=`"azure`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_ENDPOINT=`"$ENDPOINT`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_API_KEY=`"$API_KEY`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_DEPLOYMENT_NAME=`"$CHAT_DEPLOYMENT`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=`"$EMBED_DEPLOYMENT`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_VISION_DEPLOYMENT=`"$CHAT_DEPLOYMENT`"" -ForegroundColor DarkGray
Write-Host "AZURE_OPENAI_API_VERSION=`"2024-12-01-preview`"" -ForegroundColor DarkGray
Write-Host ""
Write-Host "─── Estimated Cost ──────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "Azure OpenAI base:     $0/month (pay-per-token only)" -ForegroundColor DarkGray
Write-Host "GPT-4o-mini:           ~$0.15/1M input, $0.60/1M output" -ForegroundColor DarkGray
Write-Host "Embeddings:            ~$0.02/1M tokens" -ForegroundColor DarkGray
Write-Host "Estimated monthly:     $0.10-$2.00 for light usage" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Run 'npm run dev' to start with Azure OpenAI!" -ForegroundColor Cyan
Write-Host ""
