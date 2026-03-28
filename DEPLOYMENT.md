# 🚀 Deployment Guide — Azure + GitHub

This guide covers deploying Turgo to Azure and setting up CI/CD with GitHub Actions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure (North Europe)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Container Apps Environment                   │   │
│  │                                                       │   │
│  │  ┌─────────────────┐    ┌──────────────────┐         │   │
│  │  │  turgo            │    │  meilisearch      │        │   │
│  │  │  (Next.js app)   │───▶│  (search engine)  │        │   │
│  │  │  External ingress│    │  Internal ingress  │        │   │
│  │  └────────┬─────────┘    └──────────────────┘         │   │
│  └───────────┼──────────────────────────────────────────┘   │
│              │                                               │
│   ┌──────────┼──────────────────────────────────┐           │
│   │          ▼                                   │           │
│   │  ┌──────────────┐  ┌────────────────────┐   │           │
│   │  │ PostgreSQL    │  │ Azure Cache Redis  │   │           │
│   │  │ Flexible (B1) │  │ (Basic C0)         │   │           │
│   │  │ + pgvector    │  │                    │   │           │
│   │  └──────────────┘  └────────────────────┘   │           │
│   │                                              │           │
│   │  ┌──────────────┐  ┌────────────────────┐   │           │
│   │  │ Blob Storage  │  │ Container Registry │   │           │
│   │  │ (images)      │  │ (Docker images)    │   │           │
│   │  └──────────────┘  └────────────────────┘   │           │
│   └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘

GitHub Actions → Build Image → Push to ACR → Deploy to Container Apps
```

### Estimated Monthly Cost

| Service                      | SKU             | Cost/mo     |
| ---------------------------- | --------------- | ----------- |
| PostgreSQL Flexible Server   | Burstable B1ms  | ~$12        |
| Azure Cache for Redis        | Basic C0        | ~$16        |
| Container Apps (app)         | 0.5 vCPU/1GB    | ~$5-15      |
| Container Apps (meilisearch) | 0.25 vCPU/0.5GB | ~$5         |
| Container Registry           | Basic           | ~$5         |
| Blob Storage                 | Standard LRS    | ~$1         |
| **Total**                    |                 | **~$44-54** |

---

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- [Git](https://git-scm.com/) installed
- An Azure subscription with credits
- A [GitHub](https://github.com/) account

---

## Step-by-Step Setup

### Step 1: Create a GitHub Repository

```bash
# Initialize git (if not already)
cd turgo
git init

# Create repo on GitHub (using GitHub CLI, or do it via github.com)
gh repo create turgo --private --source=. --push

# Or manually:
# 1. Go to github.com → New Repository → name: "turgo" → Private
# 2. Follow the instructions to push existing code
git remote add origin https://github.com/YOUR_USERNAME/turgo.git
git branch -M main
git push -u origin main
```

### Step 2: Login to Azure

```bash
# Login to Azure
az login

# Check your subscription
az account show --query "{name:name, id:id}" -o table

# If you have multiple subscriptions, set the correct one
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### Step 3: Run the Infrastructure Script

```bash
# Make the script executable and run it
chmod +x infra/azure-setup.sh
./infra/azure-setup.sh
```

> **Windows users:** Run this in WSL, Git Bash, or Azure Cloud Shell (portal.azure.com → Cloud Shell icon).

The script will:

1. Create a Resource Group
2. Set up Azure Container Registry
3. Create PostgreSQL with pgvector
4. Create Azure Cache for Redis
5. Create Blob Storage
6. Deploy Meilisearch as a Container App
7. Deploy the main application

**Save all the credentials printed at the end!**

### Step 4: Create Azure Service Principal (for CI/CD)

```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create service principal
az ad sp create-for-rbac \
  --name "sp-turgo" \
  --role contributor \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-turgo" \
  --sdk-auth
```

Copy the entire JSON output — you'll need it for GitHub secrets.

### Step 5: Configure GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets (values from the infrastructure script output):

| Secret Name                | Value                        |
| -------------------------- | ---------------------------- |
| `AZURE_CREDENTIALS`        | The full JSON from Step 4    |
| `ACR_LOGIN_SERVER`         | `<name>.azurecr.io`          |
| `ACR_USERNAME`             | ACR name                     |
| `ACR_PASSWORD`             | ACR admin password           |
| `DATABASE_URL`             | PostgreSQL connection string |
| `REDIS_URL`                | Redis connection string      |
| `MEILISEARCH_HOST`         | Meilisearch internal URL     |
| `MEILISEARCH_API_KEY`      | Meilisearch master key       |
| `NEXTAUTH_SECRET`          | Generated secret             |
| `AZURE_STORAGE_CONNECTION` | Storage connection string    |

### Step 6: First Deployment

```bash
# Build and push the first Docker image manually
cd turgo

# Login to ACR
az acr login --name YOUR_ACR_NAME

# Build and push
docker build -t YOUR_ACR_NAME.azurecr.io/turgo:latest .
docker push YOUR_ACR_NAME.azurecr.io/turgo:latest

# Run database migrations
# Option A: Via Azure CLI
az containerapp exec \
  --resource-group rg-turgo \
  --name turgo \
  --command "npx prisma migrate deploy"

# Option B: Run locally against Azure DB
DATABASE_URL="your-azure-database-url" npx prisma migrate deploy
DATABASE_URL="your-azure-database-url" npx prisma db seed
```

### Step 7: Verify

1. Open the app URL from the script output: `https://turgo.<hash>.azurecontainerapps.io`
2. Check logs if anything fails:
   ```bash
   az containerapp logs show \
     --resource-group rg-turgo \
     --name turgo \
     --type console \
     --follow
   ```

---

## CI/CD Workflow

After setup, the GitHub Actions pipeline runs automatically:

- **On every push to `main`:** Lint → Type check → Build Docker image → Deploy to Azure
- **On pull requests:** Lint → Type check only (no deploy)
- **Manual trigger:** Available via GitHub Actions → "Run workflow"

### Making Changes

```bash
# 1. Make your code changes
# 2. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin main

# 3. GitHub Actions automatically builds and deploys (~3-5 min)
# 4. Check progress at: github.com/YOUR_USERNAME/turgo/actions
```

---

## Giving Your Friend Access

### Code Access (GitHub)

```bash
# Option A: Add as collaborator (recommended for 2 people)
# Go to: GitHub → Your Repo → Settings → Collaborators → Add people
# Enter your friend's GitHub username
# They'll get an email invitation

# Option B: Use GitHub CLI
gh repo add-collaborator FRIEND_USERNAME --permission write
```

Your friend can then:

```bash
git clone https://github.com/YOUR_USERNAME/turgo.git
cd turgo
npm install
cp .env.example .env   # Fill in local dev values
docker compose up -d   # Start local PostgreSQL, Redis, Meilisearch
npx prisma migrate dev
npm run dev
```

### Azure Portal Access

```bash
# Add your friend as a Contributor to the resource group
az role assignment create \
  --assignee "friend@email.com" \
  --role "Contributor" \
  --resource-group "rg-turgo"
```

They'll be able to view logs, restart apps, and manage resources in the Azure Portal.

---

## Useful Commands

```bash
# ── Logs ──
az containerapp logs show -g rg-turgo -n turgo --type console --follow

# ── Restart ──
az containerapp revision restart -g rg-turgo -n turgo

# ── Scale ──
az containerapp update -g rg-turgo -n turgo --min-replicas 1 --max-replicas 5

# ── Update env vars ──
az containerapp update -g rg-turgo -n turgo \
  --set-env-vars "STRIPE_SECRET_KEY=sk_test_xxx"

# ── Connect to database ──
az postgres flexible-server connect \
  -n psql-turgo -u pgadmin -d turgo --interactive

# ── View costs ──
az consumption usage list \
  --start-date 2026-02-01 --end-date 2026-02-28 \
  -o table
```

---

## Quick Local Deploy (Skip GitHub)

During active development, you can deploy directly from your machine — no git push needed:

```powershell
# Full build + deploy (~2-3 min)
.\deploy.ps1

# Or via npm
npm run deploy

# Re-deploy without rebuilding (just update container)
.\deploy.ps1 -SkipBuild

# Deploy + run database migrations
.\deploy.ps1 -Migrate

# Deploy + seed database
.\deploy.ps1 -Seed

# Combine flags
.\deploy.ps1 -Migrate -Seed
```

**On Linux / macOS / WSL:**

```bash
chmod +x deploy.sh
./deploy.sh                    # full build + deploy
./deploy.sh --skip-build       # redeploy existing image
./deploy.sh --migrate --seed   # deploy + migrate + seed
```

**What this skips vs GitHub Actions:**

- No ESLint, TypeScript check, or tests (you're iterating fast)
- No git push required
- No GitHub Actions queue wait
- Total time: ~2-3 min vs ~5-8 min

> When the product is more stable, re-enable the GitHub Actions pipeline for proper CI/CD.

---

## Fast Testing Options

### Option 1: Dev Tunnel (Instant — no build/deploy)

Run the Next.js dev server locally with hot-reload and expose it via a public URL using Azure Dev Tunnels. Changes are reflected instantly on save.

```bash
# First time: install Dev Tunnels CLI
winget install Microsoft.devtunnel
devtunnel user login

# Start dev server + tunnel (gives you a public URL)
npm run dev:tunnel
# or
.\dev-tunnel.ps1
```

**When to use:** UI changes, feature testing, showing progress to others. No Docker needed, instant hot-reload.

### Option 2: Quick Deploy (2-4 min — cloud build)

Build the Docker image directly in Azure Container Registry (no local Docker needed) and deploy. Skips the local build + push cycle.

```bash
# Quick deploy (cloud build + deploy)
npm run deploy:quick

# Quick deploy with DB migration
npm run deploy:quick:migrate

# or directly
.\deploy-quick.ps1
.\deploy-quick.ps1 -Migrate
.\deploy-quick.ps1 -BuildOnly   # just build, don't deploy
```

**When to use:** Need to test in the real Azure environment (with real DB, Redis, etc.) but want it faster than GitHub Actions.

### Option 3: Standard Deploy (local Docker build)

The original approach — build Docker image locally, push to ACR, update Container App.

```bash
npm run deploy              # full build + deploy
npm run deploy:skip-build   # re-deploy existing image
npm run deploy:migrate      # deploy + run DB migrations
```

### Comparison

| Method          | Time      | Docker needed? | Hot reload? | Real infra?   |
| --------------- | --------- | -------------- | ----------- | ------------- |
| Dev Tunnel      | Instant   | No             | Yes         | No (local DB) |
| Quick Deploy    | 2-4 min   | No             | No          | Yes           |
| Standard Deploy | 8-15 min  | Yes            | No          | Yes           |
| GitHub Actions  | 10-20 min | No (CI)        | No          | Yes           |

---

## Local Development (unchanged)

```bash
# Start infrastructure
docker compose up -d

# Install deps & setup DB
npm install
npx prisma migrate dev
npx prisma db seed

# Run dev server
npm run dev
```

---

## Troubleshooting

| Issue                  | Solution                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Container won't start  | Check logs: `az containerapp logs show -g rg-turgo -n turgo --type console`                         |
| DB connection refused  | Ensure firewall allows Azure services: check PostgreSQL networking in Azure Portal                  |
| Redis connection error | Azure Redis uses TLS on port 6380 — ensure `REDIS_URL` starts with `rediss://`                      |
| Prisma migration fails | Run `npx prisma migrate deploy` locally against Azure DB URL                                        |
| Image push fails       | Run `az acr login --name YOUR_ACR_NAME` first                                                       |
| pgvector not available | Enable extension in Azure Portal → PostgreSQL → Server Parameters → `azure.extensions` → add VECTOR |
