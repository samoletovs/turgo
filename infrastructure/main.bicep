// ──────────────────────────────────────────────────────────────────────
// Turgo — Infrastructure as Code
//
// Resources:
//   - Azure Container Registry (Basic)
//   - Azure Container Apps Environment + App (turgo)
//   - Azure Database for PostgreSQL Flexible Server (B1ms) + pgvector
//   - Azure AI Search (Free tier)
//   - Azure Storage Account (Blob for listing images)
//   - Azure OpenAI (gpt-4o-mini + text-embedding-3-small)
//   - Log Analytics + Application Insights
//
// Deploy:
//   az deployment group create \
//     --resource-group rg-turgo \
//     --template-file infrastructure/main.bicep \
//     --parameters infrastructure/parameters.json
// ──────────────────────────────────────────────────────────────────────

targetScope = 'resourceGroup'

@description('Azure region')
param location string = 'northeurope'

@description('Azure OpenAI region (model availability)')
param openaiLocation string = 'swedencentral'

@description('PostgreSQL admin username')
param postgresAdminUser string = 'pgadmin'

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('Environment name')
param environment string = 'production'

var projectName = 'turgo'
var tags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
}

// ── Log Analytics + Application Insights ──────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${projectName}-law'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.5') }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${projectName}-ai'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Container Registry ────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: '${projectName}acr'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
  }
}

// ── PostgreSQL Flexible Server ────────────────────────────────────
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: 'psql-${projectName}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgres
  name: projectName
  properties: { charset: 'UTF8' collation: 'en_US.utf8' }
}

resource postgresFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ── Storage Account (Blob for listing images) ─────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${projectName}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true // listing images are public
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource listingsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'listings'
  properties: {
    publicAccess: 'Blob'
  }
}

// ── Azure OpenAI ──────────────────────────────────────────────────
resource openai 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: 'oai-${projectName}'
  location: openaiLocation
  tags: tags
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'oai-${projectName}'
    publicNetworkAccess: 'Enabled'
  }
}

resource gpt4oMini 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openai
  name: 'gpt-4o-mini'
  sku: { name: 'Standard' capacity: 30 }
  properties: {
    model: { format: 'OpenAI' name: 'gpt-4o-mini' version: '2024-07-18' }
  }
}

resource embedding 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openai
  name: 'text-embedding-3-small'
  sku: { name: 'GlobalStandard' capacity: 30 }
  properties: {
    model: { format: 'OpenAI' name: 'text-embedding-3-small' version: '1' }
  }
  dependsOn: [gpt4oMini] // sequential deployment to avoid conflicts
}

// ── Container Apps Environment ────────────────────────────────────
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${projectName}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Azure AI Search (Free tier) ───────────────────────────────────
resource searchService 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: 'search-${projectName}'
  location: location
  tags: tags
  sku: { name: 'free' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
  }
}

// ── Turgo App Container (external) ────────────────────────────────
resource turgoApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: projectName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        targetPort: 3000
        external: true
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        { name: 'acr-password' value: acr.listCredentials().passwords[0].value }
      ]
    }
    template: {
      containers: [
        {
          name: projectName
          image: '${acr.properties.loginServer}/${projectName}:latest'
          resources: { cpu: json('0.5') memory: '1Gi' }
          env: [
            { name: 'NODE_ENV' value: 'production' }
          ]
        }
      ]
      scale: { minReplicas: 0 maxReplicas: 3 }
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────
output appUrl string = 'https://${turgoApp.properties.configuration.ingress.fqdn}'
output acrLoginServer string = acr.properties.loginServer
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output storageAccountName string = storageAccount.name
output openaiEndpoint string = openai.properties.endpoint
output searchEndpoint string = 'https://${searchService.name}.search.windows.net'
output searchAdminKey string = searchService.listAdminKeys().primaryKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
