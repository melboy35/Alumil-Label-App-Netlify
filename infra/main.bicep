@description('The environment name. Used for naming resources.')
param environmentName string

@description('The location for all resources.')
param location string = resourceGroup().location

// Generate a unique token for resource naming (truncated for length limits)
var resourceToken = take(uniqueString(subscription().id, resourceGroup().id, location, environmentName), 8)

// Resource prefixes (3 characters max, alphanumeric only)
var prefixes = {
  staticWebApp: 'swa'
  storage: 'st'
  managedIdentity: 'id'
}

// User-Assigned Managed Identity (MANDATORY)
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'az${prefixes.managedIdentity}${resourceToken}'
  location: location
}

// Storage Account for file uploads
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefixes.storage}${resourceToken}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false // MANDATORY: disable public access to storage blob
    allowSharedKeyAccess: false // MANDATORY: disable storage account local auth (key access)
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }

  // Blob containers
  resource blobService 'blobServices@2023-01-01' = {
    name: 'default'
    
    resource excelUploadsContainer 'containers@2023-01-01' = {
      name: 'excel-uploads'
      properties: {
        publicAccess: 'None'
      }
    }

    resource processedFilesContainer 'containers@2023-01-01' = {
      name: 'processed-files'
      properties: {
        publicAccess: 'None'
      }
    }

    resource tempStorageContainer 'containers@2023-01-01' = {
      name: 'temp-storage'
      properties: {
        publicAccess: 'None'
      }
    }
  }
}

// Static Web App
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'az${prefixes.staticWebApp}${resourceToken}'
  location: location
  tags: {
    'azd-service-name': 'web' // MANDATORY: azd-service-name tag
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/melboy35/Alumil-Label-App-Netlify'
    branch: 'azura-branch'
    buildProperties: {
      appLocation: '/'
      apiLocation: ''
      outputLocation: ''
    }
  }
}

// Storage Blob Data Owner role assignment
resource storageRoleAssignmentOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Storage Blob Data Contributor role assignment
resource storageRoleAssignmentContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentity.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// MANDATORY Output: RESOURCE_GROUP_ID
output RESOURCE_GROUP_ID string = resourceGroup().id

// Additional outputs for configuration
output STATIC_WEB_APP_NAME string = staticWebApp.name
output STATIC_WEB_APP_DEFAULT_HOSTNAME string = staticWebApp.properties.defaultHostname
output STORAGE_ACCOUNT_NAME string = storageAccount.name
output MANAGED_IDENTITY_CLIENT_ID string = managedIdentity.properties.clientId