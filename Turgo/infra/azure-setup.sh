#!/bin/bash
# ──────────────────────────────────────────────────────────
# Azure Infrastructure Setup for Turgo
# Run: chmod +x infra/azure-setup.sh && ./infra/azure-setup.sh
# Prerequisites: Azure CLI installed and logged in (az login)
# ──────────────────────────────────────────────────────────

set -euo pipefail

# ═══════════════════════════════════════════
# CONFIGURATION — edit these values
# ═══════════════════════════════════════════
PROJECT="turgo"
LOCATION="northeurope"          # closest to Latvia
RESOURCE_GROUP="rg-${PROJECT}"
ACR_NAME="${PROJECT}acr$(openssl rand -hex 3)"   # must be globally unique
CONTAINER_ENV="cae-${PROJECT}"
POSTGRES_SERVER="psql-${PROJECT}"
POSTGRES_ADMIN="pgadmin"
POSTGRES_PASSWORD="$(openssl rand -base64 24)"
REDIS_NAME="redis-${PROJECT}"
STORAGE_ACCOUNT="st${PROJECT}$(openssl rand -hex 3)"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Azure Turgo Infrastructure Setup                      ║"
echo "║  Resource Group: $RESOURCE_GROUP                        ║"
echo "║  Location:       $LOCATION                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# ── 1. Resource Group ──
echo "▸ Creating Resource Group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# ── 2. Azure Container Registry ──
echo "▸ Creating Container Registry: $ACR_NAME..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ── 3. Azure Database for PostgreSQL Flexible Server ──
echo "▸ Creating PostgreSQL Flexible Server (Burstable B1ms)..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --location "$LOCATION" \
  --admin-user "$POSTGRES_ADMIN" \
  --admin-password "$POSTGRES_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes \
  --output none

# Enable pgvector extension
echo "▸ Enabling pgvector extension..."
az postgres flexible-server parameter set \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --name azure.extensions \
  --value VECTOR \
  --output none

# Create database
echo "▸ Creating database..."
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$POSTGRES_SERVER" \
  --database-name "$PROJECT" \
  --output none

# Allow Azure services to connect
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_SERVER" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

POSTGRES_HOST="${POSTGRES_SERVER}.postgres.database.azure.com"
DATABASE_URL="postgresql://${POSTGRES_ADMIN}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${PROJECT}?sslmode=require"

# ── 4. Azure Cache for Redis ──
echo "▸ Creating Azure Cache for Redis (Basic C0)..."
az redis create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size c0 \
  --output none

echo "▸ Waiting for Redis to be ready (this takes ~5 minutes)..."
az redis wait --resource-group "$RESOURCE_GROUP" --name "$REDIS_NAME" --created 2>/dev/null || true

REDIS_KEY=$(az redis list-keys --resource-group "$RESOURCE_GROUP" --name "$REDIS_NAME" --query primaryKey -o tsv)
REDIS_HOST="${REDIS_NAME}.redis.cache.windows.net"
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380"

# ── 5. Azure Blob Storage ──
echo "▸ Creating Storage Account..."
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none

az storage container create \
  --account-name "$STORAGE_ACCOUNT" \
  --name listings \
  --public-access blob \
  --output none

STORAGE_CONNECTION=$(az storage account show-connection-string \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --query connectionString -o tsv)

# ── 6. Container Apps Environment ──
echo "▸ Creating Container Apps Environment..."
az containerapp env create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_ENV" \
  --location "$LOCATION" \
  --output none

# ── 7. Meilisearch Container App ──
echo "▸ Deploying Meilisearch as Container App..."
MEILI_MASTER_KEY="$(openssl rand -base64 24)"
az containerapp create \
  --resource-group "$RESOURCE_GROUP" \
  --name "meilisearch" \
  --environment "$CONTAINER_ENV" \
  --image getmeili/meilisearch:v1.6 \
  --target-port 7700 \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars "MEILI_MASTER_KEY=${MEILI_MASTER_KEY}" "MEILI_ENV=production" \
  --output none

MEILI_FQDN=$(az containerapp show --resource-group "$RESOURCE_GROUP" --name "meilisearch" --query "properties.configuration.ingress.fqdn" -o tsv)
MEILISEARCH_HOST="https://${MEILI_FQDN}"

# ── 8. Main Application Container App ──
echo "▸ Deploying Turgo application..."
az containerapp create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PROJECT" \
  --environment "$CONTAINER_ENV" \
  --image "${ACR_LOGIN_SERVER}/${PROJECT}:latest" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_NAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1Gi \
  --env-vars \
    "DATABASE_URL=${DATABASE_URL}" \
    "REDIS_URL=${REDIS_URL}" \
    "MEILISEARCH_HOST=${MEILISEARCH_HOST}" \
    "MEILISEARCH_API_KEY=${MEILI_MASTER_KEY}" \
    "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" \
    "NEXT_PUBLIC_APP_URL=https://placeholder.azurecontainerapps.io" \
    "AZURE_STORAGE_CONNECTION_STRING=${STORAGE_CONNECTION}" \
    "AZURE_STORAGE_CONTAINER_NAME=listings" \
    "AI_PROVIDER=github" \
    "NODE_ENV=production" \
  --output none

APP_FQDN=$(az containerapp show --resource-group "$RESOURCE_GROUP" --name "$PROJECT" --query "properties.configuration.ingress.fqdn" -o tsv)
APP_URL="https://${APP_FQDN}"

# Update the app URL now that we know it
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PROJECT" \
  --set-env-vars "NEXT_PUBLIC_APP_URL=${APP_URL}" "NEXTAUTH_URL=${APP_URL}" \
  --output none

# ══════════════════════════════════════════════════════════
# Output Summary
# ══════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✓  INFRASTRUCTURE CREATED SUCCESSFULLY                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Application URL:    $APP_URL"
echo "🗄️  PostgreSQL Host:    $POSTGRES_HOST"
echo "🔴 Redis Host:         $REDIS_HOST"
echo "🔍 Meilisearch:        $MEILISEARCH_HOST"
echo "📦 Container Registry: $ACR_LOGIN_SERVER"
echo "💾 Storage Account:    $STORAGE_ACCOUNT"
echo ""
echo "─── Credentials (SAVE THESE!) ────────────────────────────"
echo "DATABASE_URL=$DATABASE_URL"
echo "REDIS_URL=$REDIS_URL"
echo "MEILISEARCH_API_KEY=$MEILI_MASTER_KEY"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "ACR_PASSWORD=$ACR_PASSWORD"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION"
echo ""
echo "─── GitHub Secrets to Set ────────────────────────────────"
echo "AZURE_CREDENTIALS       → Run: az ad sp create-for-rbac --name sp-${PROJECT} --role contributor --scopes /subscriptions/<SUB_ID>/resourceGroups/${RESOURCE_GROUP} --sdk-auth"
echo "ACR_LOGIN_SERVER         = $ACR_LOGIN_SERVER"
echo "ACR_USERNAME             = $ACR_NAME"
echo "ACR_PASSWORD             = $ACR_PASSWORD"
echo "DATABASE_URL             = $DATABASE_URL"
echo "REDIS_URL                = $REDIS_URL"
echo "MEILISEARCH_HOST         = $MEILISEARCH_HOST"
echo "MEILISEARCH_API_KEY      = $MEILI_MASTER_KEY"
echo "NEXTAUTH_SECRET          = $NEXTAUTH_SECRET"
echo "AZURE_STORAGE_CONNECTION = $STORAGE_CONNECTION"
echo ""
echo "─── Estimated Monthly Cost ───────────────────────────────"
echo "PostgreSQL Flexible (B1ms):  ~\$12/mo"
echo "Azure Cache for Redis (C0):  ~\$16/mo"
echo "Container Apps (app):        ~\$5-15/mo (scales to zero)"
echo "Container Apps (meilisearch): ~\$5/mo"
echo "Container Registry (Basic):  ~\$5/mo"
echo "Blob Storage:                ~\$1/mo"
echo "────────────────────────────────────────────────────"
echo "TOTAL ESTIMATED:             ~\$44-54/mo"
echo ""
