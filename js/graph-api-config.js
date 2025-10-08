/**
 * Microsoft Graph API Configuration
 * Configure your Azure AD application settings here
 * 
 * SETUP INSTRUCTIONS:
 * 1. Follow GRAPH_API_SETUP.md for complete setup guide
 * 2. Client ID configured: 1f06e228-fb33-47ec-9735-6f86a4b398e1
 * 3. Update SharePoint configuration if needed
 */

window.GraphAPIConfig = {
  // Azure AD Application Configuration
  // IMPORTANT: Replace with your actual Azure AD app registration client ID
  // Get this from: Azure Portal > Azure AD > App registrations > Your App > Overview
  clientId: '1f06e228-fb33-47ec-9735-6f86a4b398e1',
  
  // SharePoint Configuration
  sharePoint: {
    // Your SharePoint tenant base URL
    baseUrl: 'https://alumildxb.sharepoint.com',
    
    // Site path where your Excel file is stored
    sitePath: '/sites/WarehouseAPP',
    
    // Primary Excel file name
    fileName: 'Inventory Data (masterfile).xlsx',
    
    // Alternative file names to search if primary file not found
    alternativeFiles: [
      'Inventory Data.xlsx',
      'masterfile.xlsx',
      'inventory.xlsx',
      'Inventory_Data.xlsx'
    ]
  },
  
  // Microsoft Graph API Scopes (required permissions)
  scopes: [
    'https://graph.microsoft.com/Sites.Read.All',
    'https://graph.microsoft.com/Files.Read.All',
    'https://graph.microsoft.com/Files.ReadWrite.All'
  ],
  
  // MSAL Authentication Configuration
  msal: {
    authority: 'https://login.microsoftonline.com/0ac1dc26-ec64-42c1-8f72-cb0a8b173849',
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  
  // Feature Configuration
  features: {
    // Auto-refresh data from SharePoint
    enableAutoRefresh: false, // Set to true to enable
    
    // Refresh interval in milliseconds (5 minutes)
    refreshInterval: 300000,
    
    // Enable offline caching
    enableOfflineMode: true,
    
    // Maximum retry attempts for failed requests
    maxRetries: 3,
    
    // Show detailed debug information
    enableDebugMode: false
  },
  
  // Custom Error Messages
  errorMessages: {
    authenticationFailed: 'Authentication failed. Please check your Azure AD configuration and try again.',
    fileNotFound: 'Inventory Excel file not found in SharePoint. Please verify the file exists and is accessible.',
    networkError: 'Network connection error. Please check your internet connection and try again.',
    permissionDenied: 'Access denied. Please ensure you have permissions to access the SharePoint file.',
    configurationError: 'Microsoft Graph API not properly configured. Please check your Azure AD app registration.'
  }
};

// Configuration validation function
window.validateGraphAPIConfig = function() {
  const config = window.GraphAPIConfig;
  const errors = [];
  const warnings = [];
  
  // Check required configuration
  if (!config.clientId) {
    errors.push('❌ Azure AD Client ID not configured');
  }
  
  if (!config.sharePoint.baseUrl) {
    errors.push('❌ SharePoint base URL not configured');
  }
  
  if (!config.sharePoint.fileName) {
    errors.push('❌ SharePoint file name not configured');
  }
  
  // Check URL format
  if (config.sharePoint.baseUrl && !config.sharePoint.baseUrl.includes('sharepoint.com')) {
    warnings.push('⚠️ SharePoint URL format may be incorrect (should contain "sharepoint.com")');
  }
  
  // Check client ID format (should be a GUID)
  if (config.clientId) {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(config.clientId)) {
      warnings.push('⚠️ Client ID format may be incorrect (should be a GUID)');
    }
  }
  
  // Output validation results
  if (errors.length > 0) {
    console.group('❌ Graph API Configuration Errors');
    errors.forEach(error => console.error(error));
    console.error('📖 Please refer to GRAPH_API_SETUP.md for setup instructions');
    console.groupEnd();
    return false;
  }
  
  if (warnings.length > 0) {
    console.group('⚠️ Graph API Configuration Warnings');
    warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
  
  if (errors.length === 0) {
    console.log('✅ Microsoft Graph API configuration is valid');
    console.log('🔗 Target SharePoint:', config.sharePoint.baseUrl + config.sharePoint.sitePath);
    console.log('📄 Target file:', config.sharePoint.fileName);
  }
  
  return true;
};

// Show setup instructions if not configured
window.showGraphAPISetupInstructions = function() {
  console.group('🚀 Microsoft Graph API Setup Required');
  console.log('Follow these steps to configure SharePoint integration:');
  console.log('');
  console.log('1. 🏢 Go to Azure Portal: https://portal.azure.com');
  console.log('2. 📋 Navigate to: Azure AD > App registrations');
  console.log('3. ➕ Create new app registration:');
  console.log('   - Name: "Alumil Inventory App"');
  console.log('   - Account types: "Accounts in this organizational directory only"');
  console.log('   - Redirect URI: Single-page application (SPA), enter your app URL');
  console.log('4. 🔑 Copy the Application (client) ID');
  console.log('5. ⚙️ Configure API permissions:');
  console.log('   - Microsoft Graph > Delegated permissions');
  console.log('   - Add: Sites.Read.All, Files.Read.All, Files.ReadWrite.All');
  console.log('6. ✅ Grant admin consent for the permissions');
  console.log('7. 📝 Update clientId in js/graph-api-config.js');
  console.log('');
  console.log('📖 Complete guide: GRAPH_API_SETUP.md');
  console.groupEnd();
};

// Auto-validate configuration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure all scripts are loaded
  setTimeout(() => {
    const isValid = window.validateGraphAPIConfig();
    
    // Show setup instructions if not configured
    if (!isValid) {
      window.showGraphAPISetupInstructions();
    }
  }, 100);
});

// Configuration validation
window.validateGraphAPIConfig = function() {
  const config = window.GraphAPIConfig;
  
  const errors = [];
  
  if (!config.clientId) {
    errors.push('Azure AD Client ID not configured');
  }
  
  if (!config.sharePoint.baseUrl) {
    errors.push('SharePoint base URL not configured');
  }
  
  if (!config.sharePoint.fileName) {
    errors.push('SharePoint file name not configured');
  }
  
  if (errors.length > 0) {
    console.warn('⚠️ Graph API Configuration Issues:', errors);
    return false;
  }
  
  console.log('✅ Graph API Configuration is valid');
  return true;
};

// Auto-validate configuration on load
document.addEventListener('DOMContentLoaded', () => {
  window.validateGraphAPIConfig();
});