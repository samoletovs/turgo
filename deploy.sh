#!/bin/bash
# ──────────────────────────────────────────────────────────
# Deploy Turgo directly from local machine to Azure
# Skips GitHub Actions — build → push → deploy in ~2-3 min
#
# Usage:
#   ./deploy.sh              # build + push + deploy
#   ./deploy.sh --skip-build # just redeploy existing image
#   ./deploy.sh --migrate    # also run prisma migrate
#   ./deploy.sh --seed       # also run prisma db seed
# ──────────────────────────────────────────────────────────

set -euo pipefail

PROJECT="turgo"
RESOURCE_GROUP="rg-turgo"
SKIP_BUILD=false
MIGRATE=false
SEED=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --migrate)    MIGRATE=true ;;
    --seed)       SEED=true ;;
  esac
done

echo ""
echo "=== Turgo Local Deploy ==="

# Auto-detect ACR
ACR_NAME=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv)
if [ -z "$ACR_NAME" ]; then
  echo "ERROR: No ACR found in $RESOURCE_GROUP. Run infra/azure-setup.sh first."
  exit 1
fi
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query "loginServer" -o tsv)
IMAGE="${ACR_LOGIN_SERVER}/${PROJECT}:latest"

echo "  ACR:   $ACR_LOGIN_SERVER"
echo "  Image: $IMAGE"

if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "[1/3] Logging into Azure Container Registry..."
  az acr login --name "$ACR_NAME"

  echo ""
  echo "[2/3] Building Docker image..."
  START=$(date +%s)
  docker build -t "$IMAGE" .
  END=$(date +%s)
  echo "  Build completed in $((END - START))s"

  echo ""
  echo "[3/3] Pushing image to ACR..."
  START=$(date +%s)
  docker push "$IMAGE"
  END=$(date +%s)
  echo "  Push completed in $((END - START))s"
else
  echo ""
  echo "Skipping build — deploying existing :latest image"
fi

echo ""
echo "Deploying to Azure Container Apps..."
az containerapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PROJECT" \
  --image "$IMAGE" \
  --output none
echo "  Container App updated!"

if [ "$MIGRATE" = true ]; then
  echo ""
  echo "Running database migrations..."
  az containerapp exec \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PROJECT" \
    --command "npx prisma migrate deploy"
fi

if [ "$SEED" = true ]; then
  echo ""
  echo "Seeding database..."
  az containerapp exec \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PROJECT" \
    --command "npx prisma db seed"
fi

APP_URL=$(az containerapp show --resource-group "$RESOURCE_GROUP" --name "$PROJECT" --query "properties.configuration.ingress.fqdn" -o tsv)
echo ""
echo "=== Deploy Complete ==="
echo "URL: https://$APP_URL"
echo ""
