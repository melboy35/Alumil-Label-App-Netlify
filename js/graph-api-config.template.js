/**
 * Microsoft Graph API Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Follow the setup guide in GRAPH_API_SETUP.md
 * 2. Replace the placeholder values below with your actual configuration
 * 3. Rename this file to 'graph-api-config.js' (remove .template)
 */

window.GraphAPIConfig = {
  // REQUIRED: Replace with your Azure AD Application (client) ID
  // Get this from Azure Portal > Azure AD > App registrations > Your App > Overview
  clientId: 'YOUR_AZURE_AD_CLIENT_ID_HERE', // Example: '12345678-1234-1234-1234-123456789012'
  
  // SharePoint Configuration
  sharePoint: {
    // Your SharePoint tenant URL
    baseUrl: 'https://alumildxb.sharepoint.com',
    
    // Site path where your Excel file is located
    sitePath: '/sites/WarehouseAPP',
    
    // Name of your inventory Excel file
    fileName: 'Inventory Data (masterfile).xlsx',
    
    // Alternative file names to search if main file not found
    alternativeFiles: [
      'Inventory Data.xlsx',
      'masterfile.xlsx',
      'inventory.xlsx',
      'Inventory_Data.xlsx'
    ]
  },
  
  // Microsoft Graph API Scopes (DO NOT CHANGE unless you know what you're doing)
  scopes: [
    'https://graph.microsoft.com/Sites.Read.All',
    'https://graph.microsoft.com/Files.Read.All',
    'https://graph.microsoft.com/Files.ReadWrite.All'
  ],
  
  // MSAL Configuration (usually no need to change)
  msal: {
    authority: 'https://login.microsoftonline.com/common',
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  },
  
  // Feature flags
  features: {
    // Enable automatic refresh of data from SharePoint
    enableAutoRefresh: true,
    
    // How often to refresh (in milliseconds) - 5 minutes = 300000
    refreshInterval: 300000,
    
    // Enable offline caching
    enableOfflineMode: true,
    
    // Maximum number of retries for failed requests
    maxRetries: 3
  },
  
  // Custom error messages
  errorMessages: {
    authenticationFailed: 'Failed to authenticate with Microsoft. Please check your Azure AD configuration.',
    fileNotFound: 'Inventory file not found in SharePoint. Please check the file name and location.',
    networkError: 'Network error. Please check your internet connection and try again.',
    permissionDenied: 'Access denied. Please ensure you have the necessary permissions to access SharePoint files.'
  }
};

/**
 * SETUP CHECKLIST:
 * 
 * □ Created Azure AD app registration
 * □ Copied client ID from Azure portal
 * □ Added required API permissions (Sites.Read.All, Files.Read.All, Files.ReadWrite.All)
 * □ Granted admin consent for permissions
 * □ Configured redirect URI (your app domain)
 * □ Updated clientId in this file
 * □ Verified SharePoint URL and file path
 * □ Renamed this file to 'graph-api-config.js'
 * 
 * TESTING:
 * 1. Open admin panel
 * 2. Click "Database Management"
 * 3. Click "Import from SharePoint (Graph API)"
 * 4. Sign in when prompted
 * 5. Verify file is imported successfully
 */

// Configuration validation (will run automatically)
window.validateGraphAPIConfig = function() {
  const config = window.GraphAPIConfig;
  const errors = [];
  
  if (!config.clientId || config.clientId === 'YOUR_AZURE_AD_CLIENT_ID_HERE') {
    errors.push('❌ Azure AD Client ID not configured');
    console.error('Please update the clientId in graph-api-config.js');
  }
  
  if (!config.sharePoint.baseUrl) {
    errors.push('❌ SharePoint base URL not configured');
  }
  
  if (!config.sharePoint.fileName) {
    errors.push('❌ SharePoint file name not configured');
  }
  
  // Check if URL looks valid
  if (config.sharePoint.baseUrl && !config.sharePoint.baseUrl.includes('sharepoint.com')) {
    errors.push('⚠️ SharePoint URL might be incorrect (should contain "sharepoint.com")');
  }
  
  if (errors.length > 0) {
    console.warn('⚠️ Graph API Configuration Issues:');
    errors.forEach(error => console.warn(error));
    console.warn('📖 Please refer to GRAPH_API_SETUP.md for configuration instructions');
    return false;
  }
  
  console.log('✅ Graph API Configuration is valid');
  console.log('🔗 SharePoint URL:', config.sharePoint.baseUrl + config.sharePoint.sitePath);
  console.log('📄 Target file:', config.sharePoint.fileName);
  return true;
};

// Auto-validate configuration when this file loads
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure DOM is ready
  setTimeout(() => {
    const isValid = window.validateGraphAPIConfig();
    
    if (!isValid) {
      // Show setup instructions in console
      console.group('🚀 Microsoft Graph API Setup Instructions');
      console.log('1. Go to Azure Portal: https://portal.azure.com');
      console.log('2. Navigate to Azure AD > App registrations');
      console.log('3. Create new app registration');
      console.log('4. Copy the Application (client) ID');
      console.log('5. Update clientId in graph-api-config.js');
      console.log('6. Add API permissions and grant consent');
      console.log('📖 Full instructions: GRAPH_API_SETUP.md');
      console.groupEnd();
    }
  }, 100);
});